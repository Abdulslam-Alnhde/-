import { aiManager } from "@/lib/ai-manager";
import {
  detectMimeType,
  extractPdfText,
  isPdfMime,
  prepareFileForAI,
  type FilePreparationTrace,
} from "@/lib/ai-file-parts";
import type { AIProvider } from "@/lib/ai/provider-interface";
import type { AIResponse } from "@/lib/ai/types";
import {
  isTransientNetworkError,
  sleep,
} from "@/lib/ai-helpers";
import {
  buildStudentBatchPrompt,
  buildStudentJsonRepairPrompt,
  buildStudentLenientBatchPrompt,
  buildStudentSinglePrompt,
  type StudentExamContext,
} from "@/lib/ai-prompts";

const STUDENT_PDF_MAX_PAGES = Math.max(
  1,
  Math.min(30, Number(process.env.STUDENT_PDF_MAX_PAGES) || 15)
);

const STUDENT_MAX_TOKENS = Math.max(
  512,
  Math.min(8192, Number(process.env.STUDENT_EXTRACT_MAX_TOKENS) || 8192)
);

/**
 * Hard ceiling on the number of model calls spent on a single student paper.
 * The free Gemini tier allows only ~20 requests/day per model, so an unbounded
 * pipeline (strict → lenient → batch → per-question rescue) can exhaust the
 * whole daily quota on one paper. This budget guarantees that never happens.
 */
const STUDENT_MAX_MODEL_CALLS = Math.max(
  1,
  Math.min(40, Number(process.env.STUDENT_MAX_MODEL_CALLS) || 12)
);

/** Thinking effort for Gemini 2.5 models. Lower = faster OCR. Empty = provider default. */
const STUDENT_REASONING_EFFORT = (() => {
  const raw = String(process.env.STUDENT_REASONING_EFFORT || "low")
    .trim()
    .toLowerCase();
  return raw === "none" || raw === "low" || raw === "medium" || raw === "high"
    ? (raw as "none" | "low" | "medium" | "high")
    : undefined;
})();

const STUDENT_RESCUE_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.STUDENT_RESCUE_CONCURRENCY) || 1)
);

const STUDENT_FILE_PART_BATCH_SIZE = Math.max(
  1,
  Math.min(6, Number(process.env.STUDENT_FILE_PART_BATCH_SIZE) || 2)
);

const STUDENT_FILE_PART_BATCH_CONCURRENCY = Math.max(
  1,
  Math.min(3, Number(process.env.STUDENT_FILE_PART_BATCH_CONCURRENCY) || 1)
);

const STUDENT_FILE_PART_BATCH_MIN_PARTS = Math.max(
  3,
  Math.min(20, Number(process.env.STUDENT_FILE_PART_BATCH_MIN_PARTS) || 6)
);

const STUDENT_REQUEST_TIMEOUT_MS = Math.max(
  45000,
  Math.min(
    300000,
    Number(process.env.STUDENT_EXTRACT_TIMEOUT_MS) ||
      Number(process.env.AI_REQUEST_TIMEOUT_MS) ||
      300000
  )
);

const STUDENT_PREP_TIMEOUT_MS = Math.max(
  15000,
  Math.min(
    180000,
    Number(process.env.STUDENT_PREP_TIMEOUT_MS) || 60000
  )
);

const STUDENT_MODEL_TIMEOUT_MS = Math.max(
  20000,
  Math.min(
    STUDENT_REQUEST_TIMEOUT_MS,
    Number(process.env.STUDENT_MODEL_TIMEOUT_MS) || 120000
  )
);

const STUDENT_MODEL_RETRIES = Math.max(
  0,
  Math.min(2, Number(process.env.STUDENT_MODEL_RETRIES) || 1)
);

const STUDENT_PDF_TEXT_CONTEXT_MAX_CHARS = Math.max(
  2000,
  Math.min(
    60000,
    Number(process.env.STUDENT_PDF_TEXT_CONTEXT_MAX_CHARS) || 24000
  )
);

function resolveStudentModels(): string[] {
  const legacy = String(process.env.STUDENT_AI_MODELS || "").trim();
  if (legacy) {
    return dedupeModels(legacy.split(",").map((v) => v.trim()).filter(Boolean));
  }
  return dedupeModels(aiManager.getServiceModels("studentExtraction"));
}

export type StudentExtractionLogger = (event: {
  stage: string;
  level?: "info" | "warn" | "error";
  message: string;
  meta?: Record<string, unknown>;
  durationMs?: number;
}) => void;

export class StudentExtractionError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    code = "STUDENT_EXTRACTION_ERROR",
    details?: Record<string, unknown>,
    cause?: unknown
  ) {
    super(message);
    this.name = "StudentExtractionError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export type StudentProviderRuntime = {
  provider: AIProvider;
  label: string;
  models: string[];
};

/**
 * Tracks how many model calls a single extraction request has spent so it can
 * never blow past the daily free-tier quota. `spend()` returns false once the
 * budget is exhausted; callers should stop issuing further model calls.
 */
export type StudentRequestBudget = {
  spend: () => boolean;
  canSpend: () => boolean;
  spent: () => number;
  limit: number;
};

function createStudentRequestBudget(
  limit = STUDENT_MAX_MODEL_CALLS
): StudentRequestBudget {
  let used = 0;
  return {
    limit,
    spent: () => used,
    canSpend: () => used < limit,
    spend: () => {
      if (used >= limit) return false;
      used += 1;
      return true;
    },
  };
}

export class StudentBudgetExhaustedError extends Error {
  constructor(message = "Student extraction request budget exhausted.") {
    super(message);
    this.name = "StudentBudgetExhaustedError";
  }
}

/** Truncated, safe JSON preview used for diagnosing empty-answer model output. */
function safeStringifyPreview(value: unknown, maxChars = 1500): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (!text) return "";
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...[truncated]`;
  } catch {
    return String(value).slice(0, maxChars);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getRootCauseMessage(error: unknown): string {
  let current = error as (Error & { cause?: unknown }) | unknown;
  let lastMessage = "";

  while (current) {
    const message = getErrorMessage(current);
    if (message) lastMessage = message;
    if (!(current instanceof Error) || !("cause" in current) || !current.cause) break;
    current = current.cause;
  }

  return lastMessage;
}

function isRateLimitOrQuotaRootCause(error: unknown): boolean {
  const rootMessage = getRootCauseMessage(error);
  const lower = rootMessage.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("rate limited") ||
    lower.includes("too many requests") ||
    lower.includes("quota")
  );
}

/** يفحص سلسلة الأسباب بحثًا عن خاصية وُسِم بها خطأ Gemini الخاص. */
function findGeminiCauseProperty<K extends string>(
  error: unknown,
  key: K
): unknown {
  let current = error as (Error & { cause?: unknown }) | unknown;
  while (current) {
    if (current && typeof current === "object" && key in (current as object)) {
      const value = (current as Record<string, unknown>)[key];
      if (value !== undefined) return value;
    }
    if (
      !(current instanceof Error) ||
      !("cause" in current) ||
      !(current as Error & { cause?: unknown }).cause
    ) {
      break;
    }
    current = (current as Error & { cause?: unknown }).cause;
  }
  return undefined;
}

function isDailyQuotaRootCause(error: unknown): boolean {
  if (findGeminiCauseProperty(error, "isGeminiDailyQuotaExhausted") === true) {
    return true;
  }
  const rootMessage = getRootCauseMessage(error).toLowerCase();
  return (
    rootMessage.includes("daily quota") ||
    rootMessage.includes("perdayperproject") ||
    rootMessage.includes("per_day") ||
    rootMessage.includes("free_tier_requests")
  );
}

function getRateLimitRetryAfterSeconds(error: unknown): number | null {
  const value = findGeminiCauseProperty(error, "retryAfterMs");
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.ceil(value / 1000);
  }
  return null;
}

/** إرجاع 429 للواجهات التي تعتمد على رمز الحالة (مثل مؤقت الانتظار في صفحة المراجعة). */
function resolveHttpStatusForStudentFailure(
  explicitStatus: number,
  cause: unknown
): number {
  if (explicitStatus === 429) return 429;
  if (isRateLimitOrQuotaRootCause(cause)) return 429;
  return explicitStatus;
}

function toUserFacingStudentFailureMessage(
  error: unknown,
  fallbackMessage: string
): string {
  const rootMessage = getRootCauseMessage(error);
  const lower = rootMessage.toLowerCase();

  if (
    lower.includes("gemini_api_key is missing") ||
    (lower.includes("api key") && lower.includes("missing"))
  ) {
    return "لم يتم إعداد مفتاح Google Gemini API. أضف GEMINI_API_KEY في ملف .env ثم أعد تشغيل الخادم.";
  }

  if (
    lower.includes("auth error") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission denied") ||
    lower.includes("invalid api")
  ) {
    return "مفتاح API المستخدم للاستخراج غير صالح أو بلا صلاحية. حدّث المفتاح في ملف .env ثم أعد المحاولة.";
  }

  if (isDailyQuotaRootCause(error)) {
    const retrySeconds = getRateLimitRetryAfterSeconds(error);
    const wait = retrySeconds
      ? ` انتظر حوالي ${retrySeconds} ثانية ثم حاول مجددًا،`
      : "";
    return (
      `تم استنفاذ الحد اليومي المجاني لخدمة Gemini على النموذج المُستخدم.${wait} ` +
      "أو أضف نماذج بديلة في AI_MODELS (مثل gemini-2.5-flash-lite,gemini-2.0-flash) في ملف .env، " +
      "أو ارفع خطة المفتاح في Google AI Studio."
    );
  }

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
    const retrySeconds = getRateLimitRetryAfterSeconds(error);
    if (retrySeconds) {
      return `خدمة Gemini وصلت إلى حد الاستخدام اللحظي. انتظر حوالي ${retrySeconds} ثانية ثم أعد المحاولة.`;
    }
    return "خدمة Gemini وصلت إلى حد الاستخدام الحالي. انتظر قليلًا ثم أعد المحاولة.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "انتهت مهلة استخراج ورقة الطالب قبل أن تكتمل العملية. جرّب ملفًا أصغر أو أعد المحاولة بعد قليل.";
  }

  if (rootMessage && rootMessage !== fallbackMessage) {
    return rootMessage;
  }

  return fallbackMessage;
}

function createStudentFailure(params: {
  fallbackMessage: string;
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}): StudentExtractionError {
  const { fallbackMessage, statusCode, code, details, cause } = params;
  const causeMessage = getRootCauseMessage(cause);
  const resolvedStatus = resolveHttpStatusForStudentFailure(statusCode, cause);

  return new StudentExtractionError(
    toUserFacingStudentFailureMessage(cause, fallbackMessage),
    resolvedStatus,
    code,
    {
      ...details,
      ...(causeMessage ? { causeMessage } : {}),
    },
    cause
  );
}

function dedupeModels(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of models) {
    const trimmed = model.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function modelsForProvider(providerName: string): string[] {
  void providerName;
  return resolveStudentModels();
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeQuestionLabel(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function resolveStudentMaxTokens(providerName: string): number {
  void providerName;
  return STUDENT_MAX_TOKENS;
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    isTransientNetworkError(error) ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("empty response") ||
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("503") ||
    lower.includes("server error") ||
    lower.includes("overloaded") ||
    lower.includes("unavailable")
  );
}

function createTimeoutError(label: string, timeoutMs: number): StudentExtractionError {
  return new StudentExtractionError(
    `${label} timed out after ${timeoutMs}ms.`,
    504,
    "TIMEOUT",
    { timeoutMs, label }
  );
}

async function runWithTimeout<T>(
  task: Promise<T> | (() => Promise<T>),
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const promise = typeof task === "function" ? task() : task;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runWithRetries<T>(params: {
  label: string;
  attempts: number;
  task: () => Promise<T>;
  logger?: StudentExtractionLogger;
  meta?: Record<string, unknown>;
}): Promise<T> {
  const { label, attempts, task, logger, meta } = params;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const start = Date.now();
    try {
      logger?.({
        stage: `${label}.attempt`,
        message: `Attempt ${attempt}/${attempts}`,
        meta: { ...meta, attempt, attempts },
      });
      const result = await task();
      logger?.({
        stage: `${label}.success`,
        message: `Succeeded on attempt ${attempt}.`,
        durationMs: Date.now() - start,
        meta: { ...meta, attempt, attempts },
      });
      return result;
    } catch (error) {
      lastError = error;
      logger?.({
        stage: `${label}.failure`,
        level: "warn",
        message: `Attempt ${attempt}/${attempts} failed.`,
        durationMs: Date.now() - start,
        meta: {
          ...meta,
          attempt,
          attempts,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      // الحدّ اليومي للخطة المجانية لا يُصلَح بإعادة المحاولة الآن: نخرج فورًا
      // ليتاح للسلسلة الخارجية تجريب نموذج بديل أو رفع رسالة واضحة للمستخدم.
      if (isDailyQuotaRootCause(error)) {
        throw error;
      }
      if (attempt >= attempts || !isRetryableError(error)) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      const lower = msg.toLowerCase();
      const isRate =
        lower.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("rate limited") ||
        lower.includes("quota");
      const retryAfterSeconds = isRate
        ? getRateLimitRetryAfterSeconds(error)
        : null;
      const delayMs = isRate
        ? Math.min(
            60000,
            retryAfterSeconds
              ? Math.max(retryAfterSeconds * 1000, 2000)
              : 8000 + 6000 * attempt
          )
        : Math.min(1500 * attempt, 4000);
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error(`${label} failed.`);
}

function parsePossiblyWrappedJson(rawResponse: string): any {
  const cleanResponse = String(rawResponse ?? "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .trim();

  const tryParse = (candidate: string) => {
    const parsed = JSON.parse(candidate);
    if (typeof parsed === "string") return JSON.parse(parsed);
    return parsed;
  };

  if (
    (cleanResponse.startsWith("{") && cleanResponse.endsWith("}")) ||
    (cleanResponse.startsWith("[") && cleanResponse.endsWith("]"))
  ) {
    try {
      return tryParse(cleanResponse);
    } catch {
      // continue to block extraction
    }
  }

  for (let i = 0; i < cleanResponse.length; i += 1) {
    const opener = cleanResponse[i];
    if (opener !== "{" && opener !== "[") continue;
    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < cleanResponse.length; j += 1) {
      const ch = cleanResponse[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === opener) depth += 1;
      else if (ch === closer) {
        depth -= 1;
        if (depth === 0) return tryParse(cleanResponse.slice(i, j + 1));
      }
    }
  }

  throw new Error("No valid JSON block was found in the model response.");
}

/** Converts Arabic-Indic digits to ASCII and pulls the first integer found. */
function extractFirstInteger(value: unknown): number | null {
  const text = String(value ?? "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isInteger(n) ? n : null;
}

/** Reads the student's answer text across the many keys models tend to use. */
function readStudentAnswerText(raw: any): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  const candidate =
    raw?.studentAnswer ??
    raw?.student_answer ??
    raw?.answer ??
    raw?.answerText ??
    raw?.answer_text ??
    raw?.response ??
    raw?.studentResponse ??
    raw?.student_response ??
    raw?.transcription ??
    raw?.transcript ??
    raw?.studentText ??
    raw?.writtenAnswer ??
    raw?.written ??
    raw?.ans;
  return String(candidate ?? "").trim();
}

function readStudentQuestionText(raw: any): string {
  if (raw == null || typeof raw === "string") return "";
  return String(
    raw?.questionText ?? raw?.question ?? raw?.prompt ?? raw?.text ?? ""
  ).trim();
}

function normalizeSingleStudentPayload(raw: any, fallbackQuestionNumber: number) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Student extraction did not return a JSON object.");
  }

  const inner =
    !Array.isArray(raw) && Array.isArray(raw?.answers) && raw.answers.length > 0
      ? raw.answers[0]
      : raw;

  const questionNumber =
    toNumber(inner?.questionNumber ?? inner?.id ?? inner?.number) ??
    extractFirstInteger(inner?.questionNumber ?? inner?.questionLabel ?? inner?.label) ??
    fallbackQuestionNumber;

  return {
    questionNumber,
    questionText: readStudentQuestionText(inner),
    studentAnswer: readStudentAnswerText(inner),
  };
}

function resolveStudentQuestionNumber(
  raw: any,
  labelToId?: Map<string, number>
): number | null {
  const direct = toNumber(raw?.questionNumber ?? raw?.id ?? raw?.number);
  if (direct != null && Number.isInteger(direct)) return direct;

  const label = normalizeQuestionLabel(
    raw?.questionLabel ??
      raw?.displayLabel ??
      raw?.label ??
      raw?.questionNumber ??
      raw?.id ??
      raw?.number
  );
  if (label && labelToId?.has(label)) return labelToId.get(label) ?? null;

  // Models sometimes return "Q1", "1)", "السؤال ٣". Pull the first integer and
  // map it back to a real question id when possible.
  const fromText = extractFirstInteger(
    raw?.questionNumber ?? raw?.id ?? raw?.number ?? raw?.questionLabel ?? raw?.label
  );
  if (fromText != null) {
    const mapped = labelToId?.get(String(fromText));
    return mapped ?? fromText;
  }

  return null;
}

function normalizeStudentAnswerItem(raw: any, labelToId?: Map<string, number>) {
  const questionNumber = resolveStudentQuestionNumber(raw, labelToId);
  if (!questionNumber) return null;

  return {
    questionNumber,
    questionText: readStudentQuestionText(raw),
    studentAnswer: readStudentAnswerText(raw),
  };
}

/** Finds the array of answer objects regardless of the wrapper key the model used. */
function coerceStudentAnswerArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const candidateKeys = [
    "answers",
    "results",
    "questions",
    "studentAnswers",
    "student_answers",
    "items",
    "data",
    "output",
    "extractedAnswers",
  ];
  for (const key of candidateKeys) {
    if (Array.isArray(data[key])) return data[key];
  }

  // Object keyed by question number/label: { "1": "...", "Q2": { ... } }
  const entries = Object.entries(data).filter(([key]) =>
    extractFirstInteger(key) != null
  );
  if (entries.length > 0) {
    return entries.map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return { questionNumber: key, ...(value as object) };
      }
      return { questionNumber: key, studentAnswer: value };
    });
  }

  return [];
}

function normalizeStudentBatchPayload(
  data: any,
  questions?: Array<{ id: number; label?: string }>
) {
  const labelToId = new Map<string, number>();
  for (const question of questions ?? []) {
    const idLabel = normalizeQuestionLabel(question.id);
    const displayLabel = normalizeQuestionLabel(question.label);
    if (idLabel) labelToId.set(idLabel, question.id);
    if (displayLabel) labelToId.set(displayLabel, question.id);
  }

  const items = coerceStudentAnswerArray(data);

  return items
    .map((item: any) => normalizeStudentAnswerItem(item, labelToId))
    .filter(
      (
        item: {
          questionNumber: number;
          questionText: string;
          studentAnswer: string;
        } | null
      ): item is {
        questionNumber: number;
        questionText: string;
        studentAnswer: string;
      } => Boolean(item)
    );
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    out.push(items.slice(i, i + batchSize));
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await task(items[index], index);
      }
    })
  );

  return results;
}

function mergeStudentAnswer(
  resultsMap: Map<
    number,
    { questionNumber: number; questionText: string; studentAnswer: string }
  >,
  item: { questionNumber: number; questionText: string; studentAnswer: string }
) {
  const existing = resultsMap.get(item.questionNumber);
  if (!existing || (!existing.studentAnswer.trim() && item.studentAnswer.trim())) {
    resultsMap.set(item.questionNumber, item);
  }
}

function previewStudentAnswer(value: string, maxChars = 180): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

function logStudentQuestionRows(params: {
  logger?: StudentExtractionLogger;
  stage: string;
  rows: Array<{ questionNumber: number; questionText?: string; studentAnswer: string }>;
  meta?: Record<string, unknown>;
}) {
  const { logger, stage, rows, meta } = params;
  if (!logger) return;

  for (const row of rows) {
    const answer = String(row.studentAnswer || "");
    const hasAnswer = answer.trim().length > 0;
    logger({
      stage,
      message: `Q${row.questionNumber} ${hasAnswer ? "extracted" : "checked with no visible answer"}.`,
      meta: {
        ...meta,
        questionNumber: row.questionNumber,
        hasAnswer,
        answerLength: answer.length,
        answerPreview: previewStudentAnswer(answer),
      },
    });
  }
}

function hasVisualFilePart(part: any): boolean {
  return Boolean(part?.image) || Boolean(part?.pdf);
}

function shouldUseFilePartBatches(fileParts: any[]): boolean {
  const visualCount = fileParts.filter(hasVisualFilePart).length;
  const textChars = fileParts.reduce(
    (sum, part) => sum + (typeof part?.text === "string" ? part.text.length : 0),
    0
  );

  return (
    visualCount >= STUDENT_FILE_PART_BATCH_MIN_PARTS ||
    fileParts.length >= STUDENT_FILE_PART_BATCH_MIN_PARTS ||
    textChars > STUDENT_PDF_TEXT_CONTEXT_MAX_CHARS
  );
}

function splitStudentFileParts(fileParts: any[]): any[][] {
  const visualParts = fileParts.filter(hasVisualFilePart);
  if (visualParts.length > 0) {
    const textContextParts = fileParts.filter((part) => !hasVisualFilePart(part));
    const visualBatches = splitIntoBatches(visualParts, STUDENT_FILE_PART_BATCH_SIZE);

    return visualBatches.map((batch, index) => [
      ...textContextParts,
      {
        text:
          `[Student answer sheet part batch ${index + 1}/${visualBatches.length}]\n` +
          "Extract only answers visible in the attached pages/images for this batch. " +
          "Other batches will be merged by question number.",
      },
      ...batch,
    ]);
  }

  return splitIntoBatches(fileParts, STUDENT_FILE_PART_BATCH_SIZE);
}

export function buildSingleQuestionPrompt(params: {
  questionNumber: number;
  questionText?: string;
  questionLabel?: string;
  examContext?: StudentExamContext;
}): string {
  return buildStudentSinglePrompt(params);
}
const buildBatchPrompt = buildStudentBatchPrompt;
const buildLenientBatchPrompt = buildStudentLenientBatchPrompt;

function buildFinalStudentResults(
  questions: Array<{ id: number; text?: string }>,
  resultsMap: Map<
    number,
    { questionNumber: number; questionText: string; studentAnswer: string }
  >
) {
  return questions.map((q) => {
    const found = resultsMap.get(q.id);
    return (
      found ?? {
        questionNumber: q.id,
        questionText: q.text || "",
        studentAnswer: "",
      }
    );
  });
}

function studentFileTrace(logger?: StudentExtractionLogger): FilePreparationTrace | undefined {
  if (!logger) return undefined;
  return (event) => {
    logger({
      stage: `file.${event.stage}`,
      message: event.message,
      meta: event.meta,
    });
  };
}

function createStudentFilePartsPrompt(providerName: string): {
  includePdfText: boolean;
  preferTextOnlyForPdf: boolean;
} {
  if (providerName === "google") {
    return {
      includePdfText: false,
      preferTextOnlyForPdf: false,
    };
  }

  return {
    includePdfText: false,
    preferTextOnlyForPdf: false,
  };
}

function trimStudentPdfTextContext(text: string): string {
  const normalized = String(text || "").trim();
  if (normalized.length <= STUDENT_PDF_TEXT_CONTEXT_MAX_CHARS) return normalized;
  return `${normalized.slice(0, STUDENT_PDF_TEXT_CONTEXT_MAX_CHARS)}\n\n[TRUNCATED ${normalized.length - STUDENT_PDF_TEXT_CONTEXT_MAX_CHARS} CHARS]`;
}

async function buildStudentPdfTextContextPart(params: {
  file: File;
  logger?: StudentExtractionLogger;
}) {
  const { file, logger } = params;
  const includePdfTextContext =
    String(process.env.STUDENT_INCLUDE_PDF_TEXT_CONTEXT || "false")
      .trim()
      .toLowerCase() === "true";
  if (!includePdfTextContext) {
    return null;
  }
  if (!isPdfMime(detectMimeType(file))) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer, studentFileTrace(logger));
    if (!text || text.trim().length < 80) {
      logger?.({
        stage: "file.pdf.text.context.skipped",
        message: "PDF text context was unavailable or too short.",
        meta: { fileName: file.name, charCount: text?.trim().length || 0 },
      });
      return null;
    }

    const trimmed = trimStudentPdfTextContext(text);
    logger?.({
      stage: "file.pdf.text.context.available",
      message: "PDF text context added to student extraction parts.",
      meta: { fileName: file.name, charCount: trimmed.length },
    });

    return {
      text: `[Student answer sheet extracted PDF text]\n${file.name}\n\n${trimmed}`,
    };
  } catch (error) {
    logger?.({
      stage: "file.pdf.text.context.failed",
      level: "warn",
      message: "Failed to extract PDF text context; continuing with rendered pages.",
      meta: {
        fileName: file.name,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return null;
  }
}

async function buildFileParts(params: {
  file: File;
  providerName: string;
  logger?: StudentExtractionLogger;
}) {
  const { file, providerName, logger } = params;
  const start = Date.now();
  logger?.({
    stage: "file.prepare.start",
    message: "Preparing student file for AI extraction.",
    meta: { fileName: file.name, providerName },
  });

  const [pdfTextContextPart, preparedParts] = await Promise.all([
    buildStudentPdfTextContextPart({ file, logger }),
    runWithTimeout<any[]>(
      prepareFileForAI(file, {
        providerName,
        roleLabel: "Student answer sheet",
        maxPdfPages: STUDENT_PDF_MAX_PAGES,
        ...createStudentFilePartsPrompt(providerName),
        trace: studentFileTrace(logger),
      }),
      STUDENT_PREP_TIMEOUT_MS,
      `file preparation (${file.name})`
    ),
  ]);

  const parts = pdfTextContextPart
    ? [pdfTextContextPart, ...preparedParts]
    : preparedParts;

  logger?.({
    stage: "file.prepare.done",
    message: "Student file preparation completed.",
    durationMs: Date.now() - start,
    meta: {
      fileName: file.name,
      providerName,
      partsCount: parts.length,
    },
  });

  return parts;
}

async function callModelWithTimeout(params: {
  provider: AIProvider;
  modelName: string;
  prompt: string;
  fileParts: any[];
  logger?: StudentExtractionLogger;
  budget?: StudentRequestBudget;
}) {
  const { provider, modelName, prompt, fileParts, logger, budget } = params;
  if (budget && !budget.spend()) {
    throw new StudentBudgetExhaustedError(
      `Request budget of ${budget.limit} model calls reached; stopping to protect the daily quota.`
    );
  }
  const start = Date.now();
  logger?.({
    stage: "model.call.start",
    message: "Calling model for extraction.",
    meta: {
      providerName: provider.name,
      modelName,
      filePartsCount: fileParts.length,
      budgetSpent: budget?.spent(),
      budgetLimit: budget?.limit,
    },
  });

  const result = await runWithRetries<AIResponse>({
    label: `model.${provider.name}.${modelName}`,
    attempts: STUDENT_MODEL_RETRIES + 1,
    logger,
    meta: { providerName: provider.name, modelName },
    task: async () => {
      return runWithTimeout<AIResponse>(
        provider.generateContent([{ text: prompt }, ...fileParts], {
          model: modelName,
          temperature: 0,
          maxTokens: resolveStudentMaxTokens(provider.name),
          responseMimeType: "application/json",
          reasoningEffort: STUDENT_REASONING_EFFORT,
        }),
        STUDENT_MODEL_TIMEOUT_MS,
        `model call ${provider.name}/${modelName}`
      );
    },
  });

  logger?.({
    stage: "model.call.done",
    message: "Model call completed.",
    durationMs: Date.now() - start,
    meta: {
      providerName: provider.name,
      modelName,
      usage: result.usage,
      textLength: result.text?.length || 0,
    },
  });

  return result;
}

async function generateParsedModelOutput(params: {
  provider: AIProvider;
  modelName: string;
  prompt: string;
  fileParts: any[];
  logger?: StudentExtractionLogger;
  budget?: StudentRequestBudget;
}) {
  const { provider, modelName, prompt, fileParts, logger, budget } = params;
  const result = await callModelWithTimeout({
    provider,
    modelName,
    prompt,
    fileParts,
    logger,
    budget,
  });

  try {
    return parsePossiblyWrappedJson(result.text || "");
  } catch (parseError) {
    logger?.({
      stage: "model.parse.retry",
      level: "warn",
      message: "Model response was not valid JSON; attempting repair.",
      meta: {
        providerName: provider.name,
        modelName,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      },
    });

    const repaired = await callModelWithTimeout({
      provider,
      modelName,
      prompt: buildStudentJsonRepairPrompt(result.text || ""),
      fileParts: [],
      logger,
      budget,
    });

    return parsePossiblyWrappedJson(repaired.text || "");
  }
}

export function createStudentExtractionProviderRuntimes(): StudentProviderRuntime[] {
  let provider: AIProvider;
  try {
    provider = aiManager.getServiceProvider("studentExtraction");
  } catch (error) {
    throw createStudentFailure({
      fallbackMessage:
        "No AI provider is configured for student extraction. Configure STUDENT_EXTRACTION_PROVIDER (or EXTRACTION_PROVIDER / AI_PROVIDER) and the matching API key.",
      statusCode: 503,
      code: "NO_PROVIDER",
      cause: error,
    });
  }

  const models = modelsForProvider(provider.name);
  if (models.length === 0) {
    throw new StudentExtractionError(
      "No model is configured for student extraction. Set STUDENT_EXTRACTION_MODELS or EXTRACTION_MODELS or AI_MODELS.",
      503,
      "NO_PROVIDER"
    );
  }

  return [{ provider, label: provider.name, models }];
}

export async function extractSingleStudentAnswer(params: {
  prompt: string;
  file: File;
  providers: StudentProviderRuntime[];
  questionNumber: number;
  logger?: StudentExtractionLogger;
  examContext?: StudentExamContext;
}) {
  const { prompt, file, providers, questionNumber, logger } = params;
  let lastError: unknown = null;
  const budget = createStudentRequestBudget();

  for (const runtime of providers) {
    let fileParts: any[] = [];
    try {
      fileParts = await buildFileParts({
        file,
        providerName: runtime.provider.name,
        logger,
      });
    } catch (error) {
      lastError = error;
      logger?.({
        stage: "single.file.failed",
        level: "warn",
        message: "File preparation failed for a single-question extraction provider.",
        meta: {
          providerName: runtime.provider.name,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      continue;
    }

    for (const modelName of runtime.models) {
      if (!budget.canSpend()) break;
      try {
        if (shouldUseFilePartBatches(fileParts)) {
          const filePartBatches = splitStudentFileParts(fileParts);
          let emptyResult:
            | { questionNumber: number; questionText: string; studentAnswer: string }
            | null = null;

          logger?.({
            stage: "single.file-batch.plan",
            message: "Single-question extraction will scan the file in smaller part batches.",
            meta: {
              providerName: runtime.provider.name,
              modelName,
              questionNumber,
              filePartsCount: fileParts.length,
              filePartBatchCount: filePartBatches.length,
            },
          });

          for (let i = 0; i < filePartBatches.length; i += 1) {
            if (!budget.canSpend()) break;
            const partBatchNumber = i + 1;
            const raw = await generateParsedModelOutput({
              provider: runtime.provider,
              modelName,
              prompt,
              fileParts: filePartBatches[i],
              logger,
              budget,
            });
            const normalized = normalizeSingleStudentPayload(raw, questionNumber);
            logStudentQuestionRows({
              logger,
              stage: "single.file-batch.question",
              rows: [normalized],
              meta: {
                providerName: runtime.provider.name,
                modelName,
                partBatchNumber,
                partBatchCount: filePartBatches.length,
              },
            });

            if (normalized.studentAnswer.trim()) {
              return normalized;
            }
            emptyResult ??= normalized;
          }

          if (emptyResult) {
            return emptyResult;
          }
        }

        const raw = await generateParsedModelOutput({
          provider: runtime.provider,
          modelName,
          prompt,
          fileParts,
          logger,
          budget,
        });
        const normalized = normalizeSingleStudentPayload(raw, questionNumber);
        logger?.({
          stage: "single.normalize.done",
          message: "Single-question extraction normalized successfully.",
          meta: {
            providerName: runtime.provider.name,
            modelName,
            questionNumber: normalized.questionNumber,
            answerLength: normalized.studentAnswer.length,
          },
        });
        logStudentQuestionRows({
          logger,
          stage: "single.question",
          rows: [normalized],
          meta: {
            providerName: runtime.provider.name,
            modelName,
          },
        });
        return normalized;
      } catch (error) {
        lastError = error;
        if (error instanceof StudentBudgetExhaustedError) break;
        const isRateLimited = isRateLimitOrQuotaRootCause(error);
        const isDailyQuota = isDailyQuotaRootCause(error);
        const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
        logger?.({
          stage: "single.model.failed",
          level: "warn",
          message: isDailyQuota
            ? `Model ${modelName} hit its daily free-tier quota during single-question extraction; trying next model.`
            : isRateLimited
              ? `Model ${modelName} was rate limited during single-question extraction; trying next model.`
              : "Single-question extraction attempt failed.",
          meta: {
            providerName: runtime.provider.name,
            modelName,
            error: error instanceof Error ? error.message : String(error),
            isRateLimited,
            isDailyQuota,
            retryAfterSeconds,
          },
        });
        // نستمر في الحلقة لتجريب النموذج التالي حتى على 429.
      }
    }
  }

  if (lastError instanceof StudentExtractionError) {
    throw lastError;
  }

  if (isRateLimitOrQuotaRootCause(lastError)) {
    throw createStudentFailure({
      fallbackMessage:
        "تم استنفاذ حد الاستخدام لجميع نماذج Gemini المُهيَّأة. أضف نماذج بديلة في AI_MODELS أو ارفع خطة المفتاح ثم أعد المحاولة.",
      statusCode: 429,
      code: isDailyQuotaRootCause(lastError)
        ? "DAILY_QUOTA_EXHAUSTED"
        : "RATE_LIMITED",
      details: {
        retryAfterSeconds: getRateLimitRetryAfterSeconds(lastError),
      },
      cause: lastError,
    });
  }

  throw createStudentFailure({
    fallbackMessage:
      "Student single-question extraction failed after exhausting the configured model fallbacks.",
    statusCode: 502,
    code: "SINGLE_EXTRACTION_FAILED",
    cause: lastError,
  });
}

async function extractStudentAnswersAcrossFilePartBatches(params: {
  runtime: StudentProviderRuntime;
  modelName: string;
  questions: Array<{ id: number; label?: string; text?: string; examContext?: StudentExamContext }>;
  fileParts: any[];
  logger?: StudentExtractionLogger;
  mode: "strict" | "lenient";
  budget?: StudentRequestBudget;
}) {
  const { runtime, modelName, questions, fileParts, logger, mode, budget } = params;
  const filePartBatches = splitStudentFileParts(fileParts);
  const resultsMap = new Map<
    number,
    { questionNumber: number; questionText: string; studentAnswer: string }
  >();

  logger?.({
    stage: "file-batch.plan",
    message: "Student extraction will scan the file in smaller part batches.",
    meta: {
      providerName: runtime.provider.name,
      modelName,
      mode,
      filePartsCount: fileParts.length,
      filePartBatchCount: filePartBatches.length,
      filePartBatchSize: STUDENT_FILE_PART_BATCH_SIZE,
      questionCount: questions.length,
      concurrency: STUDENT_FILE_PART_BATCH_CONCURRENCY,
    },
  });

  const outputs = await mapWithConcurrency(
    filePartBatches,
    STUDENT_FILE_PART_BATCH_CONCURRENCY,
    async (partBatch, partBatchIndex) => {
      const partBatchNumber = partBatchIndex + 1;
      const partBatchStart = Date.now();
      logger?.({
        stage: "file-batch.start",
        message: `Scanning student answer sheet part batch ${partBatchNumber}/${filePartBatches.length}.`,
        meta: {
          providerName: runtime.provider.name,
          modelName,
          mode,
          partBatchNumber,
          partBatchCount: filePartBatches.length,
          partCount: partBatch.length,
        },
      });

      const raw = await generateParsedModelOutput({
        provider: runtime.provider,
        modelName,
        prompt:
          mode === "lenient"
            ? buildLenientBatchPrompt(questions)
            : buildBatchPrompt(questions),
        fileParts: partBatch,
        logger,
        budget,
      });
      const normalized = normalizeStudentBatchPayload(raw, questions);

      logger?.({
        stage: "file-batch.done",
        message: `Student file part batch ${partBatchNumber}/${filePartBatches.length} completed.`,
        durationMs: Date.now() - partBatchStart,
        meta: {
          providerName: runtime.provider.name,
          modelName,
          mode,
          partBatchNumber,
          partBatchCount: filePartBatches.length,
          extractedCount: normalized.filter((item: { studentAnswer: string }) =>
            item.studentAnswer.trim()
          ).length,
        },
      });
      logStudentQuestionRows({
        logger,
        stage: "file-batch.question",
        rows: normalized,
        meta: {
          providerName: runtime.provider.name,
          modelName,
          mode,
          partBatchNumber,
          partBatchCount: filePartBatches.length,
        },
      });

      return normalized;
    }
  );

  for (const normalized of outputs) {
    for (const item of normalized) {
      mergeStudentAnswer(resultsMap, item);
    }
  }

  const finalResults = buildFinalStudentResults(questions, resultsMap);
  logStudentQuestionRows({
    logger,
    stage: "file-batch.final-question",
    rows: finalResults,
    meta: {
      providerName: runtime.provider.name,
      modelName,
      mode,
      filePartBatchCount: filePartBatches.length,
    },
  });

  return finalResults;
}

/**
 * Re-extracts only the questions that came back empty — one model call per
 * question, with the first configured model, capped by the shared request
 * budget. Used after a pass already found *some* answers (a partial paper);
 * re-scanning an apparently blank paper just wastes the daily quota.
 */
async function rescueMissingStudentAnswers(params: {
  runtime: StudentProviderRuntime;
  questions: Array<{ id: number; label?: string; text?: string; examContext?: StudentExamContext }>;
  finalResults: Array<{ questionNumber: number; questionText: string; studentAnswer: string }>;
  resultsMap: Map<
    number,
    { questionNumber: number; questionText: string; studentAnswer: string }
  >;
  fileParts: any[];
  logger?: StudentExtractionLogger;
  budget: StudentRequestBudget;
  rescueLimit: number;
}) {
  const {
    runtime,
    questions,
    finalResults,
    resultsMap,
    fileParts,
    logger,
    budget,
    rescueLimit,
  } = params;

  const missing = finalResults
    .filter((row) => !String(row.studentAnswer || "").trim())
    .slice(0, rescueLimit);
  if (missing.length === 0) return finalResults;

  const rescueModel = runtime.models[0];
  logger?.({
    stage: "missing.rescue.start",
    message: "Rescuing missing handwritten answers (single model, budget-aware).",
    meta: {
      providerName: runtime.provider.name,
      modelName: rescueModel,
      missingCount: missing.length,
      rescueLimit,
      budgetRemaining: budget.limit - budget.spent(),
    },
  });

  const rescuedRows = await mapWithConcurrency(
    missing,
    STUDENT_RESCUE_CONCURRENCY,
    async (row) => {
      if (!budget.canSpend()) {
        return { row, rescued: null as { studentAnswer: string } | null };
      }
      const q = questions.find((qq) => qq.id === row.questionNumber);
      const prompt = buildSingleQuestionPrompt({
        questionNumber: row.questionNumber,
        questionText: q?.text || row.questionText || "",
        questionLabel: q?.label,
        examContext: q?.examContext,
      });
      try {
        const raw = await generateParsedModelOutput({
          provider: runtime.provider,
          modelName: rescueModel,
          prompt,
          fileParts,
          logger,
          budget,
        });
        const normalized = normalizeSingleStudentPayload(raw, row.questionNumber);
        return {
          row,
          rescued: normalized.studentAnswer.trim() ? normalized : null,
        };
      } catch {
        return { row, rescued: null };
      }
    }
  );

  for (const { row, rescued } of rescuedRows) {
    if (!rescued || !String(rescued.studentAnswer || "").trim()) continue;
    mergeStudentAnswer(resultsMap, rescued as {
      questionNumber: number;
      questionText: string;
      studentAnswer: string;
    });
    row.studentAnswer = rescued.studentAnswer;
    row.questionText =
      row.questionText ||
      (rescued as { questionText?: string }).questionText ||
      "";
  }

  logger?.({
    stage: "missing.rescue.done",
    message: "Missing-answer rescue completed.",
    meta: {
      providerName: runtime.provider.name,
      extractedCount: finalResults.filter((item) => item.studentAnswer.trim()).length,
    },
  });

  return finalResults;
}

export async function extractStudentAnswersInBatches(params: {
  file: File;
  questions: Array<{ id: number; label?: string; text?: string; examContext?: StudentExamContext }>;
  providers: StudentProviderRuntime[];
  logger?: StudentExtractionLogger;
}) {
  const { file, questions, providers, logger } = params;
  let lastError: unknown = null;

  const rescueEnabled =
    String(process.env.STUDENT_MISSING_RESCUE_ENABLED || "").trim().toLowerCase() !== "false";
  const configuredRescueLimit = Number(process.env.STUDENT_MISSING_RESCUE_LIMIT);
  const rescueLimit = Math.max(
    0,
    Math.min(
      50,
      Number.isFinite(configuredRescueLimit) && configuredRescueLimit > 0
        ? configuredRescueLimit
        : 8
    )
  );

  // One shared budget for the whole request so a single paper can never burn
  // through the daily free-tier quota across strict/lenient/rescue stages.
  const budget = createStudentRequestBudget();
  const countAnswers = (rows: Array<{ studentAnswer: string }>): number =>
    rows.filter((r) => String(r.studentAnswer || "").trim()).length;

  for (const runtime of providers) {
    try {
      const fileParts = await buildFileParts({
        file,
        providerName: runtime.provider.name,
        logger,
      });
      const resultsMap = new Map<
        number,
        { questionNumber: number; questionText: string; studentAnswer: string }
      >();

      // ── Large multi-page files → scan in smaller file-part batches ──────
      if (shouldUseFilePartBatches(fileParts)) {
        logger?.({
          stage: "file-batch.first",
          message: "Large student file detected; scanning in smaller file-part batches.",
          meta: {
            providerName: runtime.provider.name,
            modelCount: runtime.models.length,
            questionCount: questions.length,
            filePartsCount: fileParts.length,
            budgetLimit: budget.limit,
          },
        });

        let bestResults:
          | Array<{ questionNumber: number; questionText: string; studentAnswer: string }>
          | null = null;

        for (const modelName of runtime.models) {
          if (!budget.canSpend()) break;
          const fileBatchStart = Date.now();
          try {
            let finalResults = await extractStudentAnswersAcrossFilePartBatches({
              runtime,
              modelName,
              questions,
              fileParts,
              logger,
              mode: "strict",
              budget,
            });

            if (countAnswers(finalResults) === 0 && budget.canSpend()) {
              logger?.({
                stage: "file-batch.lenient.start",
                level: "warn",
                message:
                  "Strict file-part extraction found no answers; trying lenient recovery.",
                meta: {
                  providerName: runtime.provider.name,
                  modelName,
                  questionCount: questions.length,
                },
              });
              finalResults = await extractStudentAnswersAcrossFilePartBatches({
                runtime,
                modelName,
                questions,
                fileParts,
                logger,
                mode: "lenient",
                budget,
              });
            }

            const extractedCount = countAnswers(finalResults);
            logger?.({
              stage: "file-batch.all.done",
              message: "Student extraction from file-part batches completed.",
              durationMs: Date.now() - fileBatchStart,
              meta: {
                providerName: runtime.provider.name,
                modelName,
                questionCount: finalResults.length,
                extractedCount,
              },
            });

            bestResults = finalResults;
            if (extractedCount > 0) return finalResults;
          } catch (error) {
            lastError = error;
            if (error instanceof StudentBudgetExhaustedError) break;
            const isRateLimited = isRateLimitOrQuotaRootCause(error);
            const isDailyQuota = isDailyQuotaRootCause(error);
            logger?.({
              stage: "file-batch.failed",
              level: "warn",
              message: isDailyQuota
                ? `Model ${modelName} hit its daily free-tier quota during file-part extraction; trying next model.`
                : isRateLimited
                  ? `Model ${modelName} was rate limited during file-part extraction; trying next model.`
                  : "File-part student extraction failed for this model.",
              durationMs: Date.now() - fileBatchStart,
              meta: {
                providerName: runtime.provider.name,
                modelName,
                error: error instanceof Error ? error.message : String(error),
                isRateLimited,
                isDailyQuota,
                retryAfterSeconds: getRateLimitRetryAfterSeconds(error),
              },
            });
          }
        }

        if (bestResults && countAnswers(bestResults) > 0) return bestResults;
        if (bestResults) {
          // A model succeeded but found nothing → genuine "no visible answers".
          throw new StudentExtractionError(
            "لم يتم العثور على إجابات طالب واضحة في الملف المرفوع. تأكد أن الملف يحتوي على إجابات الطالب وليس ورقة الأسئلة فقط، أو ارفع نسخة أوضح.",
            422,
            "NO_STUDENT_ANSWERS",
            { questionCount: questions.length }
          );
        }
        // No model call succeeded → surface the real failure (e.g. quota).
        throw createStudentFailure({
          fallbackMessage:
            "Student extraction failed while scanning the uploaded file in smaller batches.",
          statusCode: 502,
          code: "FILE_PART_EXTRACTION_FAILED",
          details: {
            providerName: runtime.provider.name,
            questionCount: questions.length,
            filePartsCount: fileParts.length,
          },
          cause: lastError,
        });
      }

      // ── Common case: single image / few pages → one full-paper pass per model ──
      logger?.({
        stage: "single-pass.start",
        message: "Starting full-paper student extraction.",
        meta: {
          providerName: runtime.provider.name,
          modelCount: runtime.models.length,
          questionCount: questions.length,
          filePartsCount: fileParts.length,
          budgetLimit: budget.limit,
        },
      });

      let foundAny = false;
      let anySucceeded = false;
      for (const modelName of runtime.models) {
        if (!budget.canSpend()) break;
        const passStart = Date.now();
        try {
          const raw = await generateParsedModelOutput({
            provider: runtime.provider,
            modelName,
            prompt: buildBatchPrompt(questions),
            fileParts,
            logger,
            budget,
          });
          const normalized = normalizeStudentBatchPayload(raw, questions);
          anySucceeded = true;
          for (const item of normalized) {
            mergeStudentAnswer(resultsMap, item);
          }
          const extractedCount = countAnswers([...resultsMap.values()]);

          logger?.({
            stage: "single-pass.done",
            message: "Full-paper student extraction completed.",
            durationMs: Date.now() - passStart,
            meta: {
              providerName: runtime.provider.name,
              modelName,
              questionCount: questions.length,
              extractedCount,
            },
          });

          if (extractedCount === 0) {
            // Diagnostic: surface exactly what the model returned so a genuinely
            // empty paper can be told apart from a format/normalization drop.
            logger?.({
              stage: "single-pass.empty.raw",
              level: "warn",
              message:
                "Model responded but no usable answers were parsed; logging raw payload for diagnosis.",
              meta: {
                providerName: runtime.provider.name,
                modelName,
                parsedItemCount: normalized.length,
                rawPreview: safeStringifyPreview(raw),
              },
            });
            continue;
          }

          logStudentQuestionRows({
            logger,
            stage: "single-pass.question",
            rows: buildFinalStudentResults(questions, resultsMap),
            meta: { providerName: runtime.provider.name, modelName },
          });
          foundAny = true;
          break;
        } catch (error) {
          lastError = error;
          if (error instanceof StudentBudgetExhaustedError) break;
          const isRateLimited = isRateLimitOrQuotaRootCause(error);
          const isDailyQuota = isDailyQuotaRootCause(error);
          logger?.({
            stage: "single-pass.failed",
            level: "warn",
            message: isDailyQuota
              ? `Model ${modelName} hit its daily free-tier quota; trying next model.`
              : isRateLimited
                ? `Model ${modelName} was rate limited; trying next model.`
                : "Full-paper extraction failed for this model; trying next model.",
            durationMs: Date.now() - passStart,
            meta: {
              providerName: runtime.provider.name,
              modelName,
              error: error instanceof Error ? error.message : String(error),
              isRateLimited,
              isDailyQuota,
              retryAfterSeconds: getRateLimitRetryAfterSeconds(error),
            },
          });
        }
      }

      // ── Recovery: a single lenient pass (first model) when nothing was found ──
      if (!foundAny && budget.canSpend()) {
        const modelName = runtime.models[0];
        logger?.({
          stage: "single-pass.lenient.start",
          level: "warn",
          message: "No strict answers found; trying one lenient recovery pass.",
          meta: {
            providerName: runtime.provider.name,
            modelName,
            questionCount: questions.length,
          },
        });
        try {
          const lenientRaw = await generateParsedModelOutput({
            provider: runtime.provider,
            modelName,
            prompt: buildLenientBatchPrompt(questions),
            fileParts,
            logger,
            budget,
          });
          const lenientItems = normalizeStudentBatchPayload(lenientRaw, questions);
          anySucceeded = true;
          for (const item of lenientItems) {
            mergeStudentAnswer(resultsMap, item);
          }
          const extractedCount = countAnswers([...resultsMap.values()]);
          logger?.({
            stage: "single-pass.lenient.done",
            message: "Lenient visible-answer recovery completed.",
            meta: {
              providerName: runtime.provider.name,
              modelName,
              questionCount: questions.length,
              extractedCount,
            },
          });
          if (extractedCount > 0) {
            foundAny = true;
          } else {
            logger?.({
              stage: "single-pass.lenient.empty.raw",
              level: "warn",
              message:
                "Lenient pass also returned no usable answers; logging raw payload for diagnosis.",
              meta: {
                providerName: runtime.provider.name,
                modelName,
                parsedItemCount: lenientItems.length,
                rawPreview: safeStringifyPreview(lenientRaw),
              },
            });
          }
        } catch (error) {
          lastError = error;
          logger?.({
            stage: "single-pass.lenient.failed",
            level: "warn",
            message: "Lenient recovery pass failed.",
            meta: {
              providerName: runtime.provider.name,
              modelName,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      let finalResults = buildFinalStudentResults(questions, resultsMap);

      // Rescue missing answers only when the paper clearly contains *some*
      // answers (partial). Re-scanning an apparently blank paper wastes quota.
      if (foundAny && rescueEnabled && rescueLimit > 0 && budget.canSpend()) {
        finalResults = await rescueMissingStudentAnswers({
          runtime,
          questions,
          finalResults,
          resultsMap,
          fileParts,
          logger,
          budget,
          rescueLimit,
        });
      }

      const finalExtractedCount = countAnswers(finalResults);
      logStudentQuestionRows({
        logger,
        stage: "batch.final-question",
        rows: finalResults,
        meta: {
          providerName: runtime.provider.name,
          extractedCount: finalExtractedCount,
        },
      });

      if (finalExtractedCount === 0) {
        // If every model call failed (e.g. quota/rate limit), surface that real
        // error instead of a misleading "no answers" message.
        if (!anySucceeded && lastError) {
          throw lastError instanceof Error
            ? lastError
            : new Error(String(lastError));
        }
        throw new StudentExtractionError(
          "لم يتم العثور على إجابات طالب واضحة في الملف المرفوع. تأكد أن الملف يحتوي على إجابات الطالب وليس ورقة الأسئلة فقط، أو ارفع نسخة أوضح.",
          422,
          "NO_STUDENT_ANSWERS",
          { questionCount: questions.length }
        );
      }

      logger?.({
        stage: "batch.normalize.done",
        message: "Student extraction normalized successfully.",
        meta: {
          providerName: runtime.provider.name,
          questionCount: finalResults.length,
          extractedCount: finalExtractedCount,
        },
      });

      return finalResults;
    } catch (error) {
      lastError = error;
      logger?.({
        stage: "provider.failed",
        level: "warn",
        message: "Provider failed while extracting student answers.",
        meta: {
          providerName: runtime.provider.name,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      // A clean "no answers visible" verdict must not trigger other providers
      // (they share the same key/quota); surface it directly to the user.
      if (
        error instanceof StudentExtractionError &&
        error.code === "NO_STUDENT_ANSWERS"
      ) {
        throw error;
      }
    }
  }

  if (lastError instanceof StudentExtractionError) {
    throw lastError;
  }

  if (isRateLimitOrQuotaRootCause(lastError)) {
    throw createStudentFailure({
      fallbackMessage:
        "تم استنفاذ حد الاستخدام لجميع نماذج Gemini المُهيَّأة. أضف نماذج بديلة في AI_MODELS أو ارفع خطة المفتاح ثم أعد المحاولة.",
      statusCode: 429,
      code: isDailyQuotaRootCause(lastError)
        ? "DAILY_QUOTA_EXHAUSTED"
        : "RATE_LIMITED",
      details: {
        retryAfterSeconds: getRateLimitRetryAfterSeconds(lastError),
      },
      cause: lastError,
    });
  }

  throw createStudentFailure({
    fallbackMessage:
      "Student batch extraction failed after exhausting the configured model fallbacks.",
    statusCode: 502,
    code: "BATCH_EXTRACTION_FAILED",
    cause: lastError,
  });
}
