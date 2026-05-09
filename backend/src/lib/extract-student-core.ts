import { aiManager } from "@/lib/ai-manager";
import { prepareFileForAI, type FilePreparationTrace } from "@/lib/ai-file-parts";
import type { AIProvider } from "@/lib/ai/provider-interface";
import type { AIResponse } from "@/lib/ai/types";
import {
  isTransientNetworkError,
  sleep,
} from "@/lib/ai-helpers";
import {
  buildStudentBatchPrompt,
  buildStudentJsonRepairPrompt,
  buildStudentSinglePrompt,
} from "@/lib/ai-prompts";

const STUDENT_PDF_MAX_PAGES = Math.max(
  1,
  Math.min(4, Number(process.env.STUDENT_PDF_MAX_PAGES) || 2)
);

const STUDENT_MAX_TOKENS = Math.max(
  512,
  Math.min(3072, Number(process.env.STUDENT_EXTRACT_MAX_TOKENS) || 768)
);

const STUDENT_BATCH_SIZE = Math.max(
  1,
  Math.min(6, Number(process.env.STUDENT_EXTRACT_BATCH_SIZE) || 2)
);

const STUDENT_BATCH_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.STUDENT_EXTRACT_BATCH_CONCURRENCY) || 2)
);

const STUDENT_RESCUE_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.STUDENT_RESCUE_CONCURRENCY) || 2)
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

const STUDENT_LOCAL_MAX_TOKENS_FLOOR = Math.max(
  1024,
  Math.min(4096, Number(process.env.STUDENT_LOCAL_MAX_TOKENS_FLOOR) || 2048)
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
    lower.includes("xai_api_key is missing") ||
    lower.includes("ai_api_key is missing") ||
    (lower.includes("api key") && lower.includes("missing"))
  ) {
    return "لم يتم إعداد مفتاح API لخدمة الاستخراج. أضف XAI_API_KEY في ملف .env ثم أعد تشغيل الخادم.";
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

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
    return "خدمة الذكاء الاصطناعي وصلت إلى حد الاستخدام الحالي. انتظر قليلًا ثم أعد المحاولة.";
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
  if (providerName === "ollama" || providerName === "custom") {
    return Math.max(STUDENT_MAX_TOKENS, STUDENT_LOCAL_MAX_TOKENS_FLOOR);
  }
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
      const delayMs = isRate
        ? Math.min(45000, 8000 + 6000 * attempt)
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

function normalizeSingleStudentPayload(raw: any, fallbackQuestionNumber: number) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Student extraction did not return a JSON object.");
  }

  const questionNumber =
    toNumber(raw?.questionNumber ?? raw?.id ?? raw?.number) ?? fallbackQuestionNumber;

  const studentAnswer = String(
    raw?.studentAnswer ?? raw?.answer ?? raw?.response ?? ""
  ).trim();

  const questionText = String(
    raw?.questionText ?? raw?.question ?? raw?.text ?? ""
  ).trim();

  return {
    questionNumber,
    questionText,
    studentAnswer,
  };
}

function resolveStudentQuestionNumber(
  raw: any,
  labelToId?: Map<string, number>
): number | null {
  const direct = toNumber(raw?.questionNumber ?? raw?.id ?? raw?.number);
  if (direct != null && Number.isInteger(direct)) return direct;

  const label = normalizeQuestionLabel(
    raw?.questionLabel ?? raw?.displayLabel ?? raw?.label ?? raw?.questionNumber
  );
  if (label && labelToId?.has(label)) return labelToId.get(label) ?? null;

  return direct;
}

function normalizeStudentAnswerItem(raw: any, labelToId?: Map<string, number>) {
  const questionNumber = resolveStudentQuestionNumber(raw, labelToId);
  if (!questionNumber) return null;

  return {
    questionNumber,
    questionText: String(raw?.questionText ?? raw?.question ?? raw?.text ?? "").trim(),
    studentAnswer: String(raw?.studentAnswer ?? raw?.answer ?? raw?.response ?? "").trim(),
  };
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

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.answers)
      ? data.answers
      : Array.isArray(data?.results)
        ? data.results
        : [];

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

export const buildSingleQuestionPrompt = buildStudentSinglePrompt;
const buildBatchPrompt = buildStudentBatchPrompt;

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

  const parts = await runWithTimeout<any[]>(
    prepareFileForAI(file, {
      providerName,
      roleLabel: "Student answer sheet",
      maxPdfPages: STUDENT_PDF_MAX_PAGES,
      ...createStudentFilePartsPrompt(providerName),
      trace: studentFileTrace(logger),
    }),
    STUDENT_PREP_TIMEOUT_MS,
    `file preparation (${file.name})`
  );

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
}) {
  const { provider, modelName, prompt, fileParts, logger } = params;
  const start = Date.now();
  logger?.({
    stage: "model.call.start",
    message: "Calling model for extraction.",
    meta: { providerName: provider.name, modelName, filePartsCount: fileParts.length },
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
}) {
  const { provider, modelName, prompt, fileParts, logger } = params;
  const result = await callModelWithTimeout({ provider, modelName, prompt, fileParts, logger });

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
}) {
  const { prompt, file, providers, questionNumber, logger } = params;
  let lastError: unknown = null;

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
      try {
        const raw = await generateParsedModelOutput({
          provider: runtime.provider,
          modelName,
          prompt,
          fileParts,
          logger,
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
        return normalized;
      } catch (error) {
        lastError = error;
        logger?.({
          stage: "single.model.failed",
          level: "warn",
          message: "Single-question extraction attempt failed.",
          meta: {
            providerName: runtime.provider.name,
            modelName,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  if (lastError instanceof StudentExtractionError) {
    throw lastError;
  }

  throw createStudentFailure({
    fallbackMessage:
      "Student single-question extraction failed after exhausting the configured model fallbacks.",
    statusCode: 502,
    code: "SINGLE_EXTRACTION_FAILED",
    cause: lastError,
  });
}

export async function extractStudentAnswersInBatches(params: {
  file: File;
  questions: Array<{ id: number; label?: string; text?: string }>;
  providers: StudentProviderRuntime[];
  logger?: StudentExtractionLogger;
}) {
  const { file, questions, providers, logger } = params;
  let lastError: unknown = null;
  const rescueEnabled =
    String(process.env.STUDENT_MISSING_RESCUE_ENABLED || "").trim() !== "false";
  const rescueLimit = Math.max(
    0,
    Math.min(20, Number(process.env.STUDENT_MISSING_RESCUE_LIMIT) || 8)
  );

  for (const runtime of providers) {
    try {
      const fileParts = await buildFileParts({
        file,
        providerName: runtime.provider.name,
        logger,
      });
      const batches = splitIntoBatches(questions, STUDENT_BATCH_SIZE);
      const resultsMap = new Map<
        number,
        { questionNumber: number; questionText: string; studentAnswer: string }
      >();

      logger?.({
        stage: "batch.plan",
        message: "Student answer extraction batches prepared.",
        meta: {
          providerName: runtime.provider.name,
          modelCount: runtime.models.length,
          batchCount: batches.length,
          questionCount: questions.length,
          concurrency: STUDENT_BATCH_CONCURRENCY,
        },
      });

      const batchOutputs = await mapWithConcurrency(
        batches,
        STUDENT_BATCH_CONCURRENCY,
        async (batch, batchIndex) => {
        const batchNumber = batchIndex + 1;
        const batchStart = Date.now();
        logger?.({
          stage: "batch.start",
          message: "Starting student extraction batch.",
          meta: {
            providerName: runtime.provider.name,
            batchNumber,
            batchCount: batches.length,
            questionNumbers: batch.map((q) => q.id),
          },
        });

        let batchSucceeded = false;
        let batchError: unknown = null;

        for (const modelName of runtime.models) {
          try {
            const prompt = buildBatchPrompt(batch);
            const raw = await generateParsedModelOutput({
              provider: runtime.provider,
              modelName,
              prompt,
              fileParts,
              logger,
            });
            const normalized = normalizeStudentBatchPayload(raw, batch);

            logger?.({
              stage: "batch.model.done",
              message: "Batch extraction succeeded.",
              durationMs: Date.now() - batchStart,
              meta: {
                providerName: runtime.provider.name,
                modelName,
                batchNumber,
                extractedCount: normalized.length,
              },
            });
            batchSucceeded = true;
            return normalized;
          } catch (error) {
            batchError = error;
            lastError = error;
            logger?.({
              stage: "batch.model.failed",
              level: "warn",
              message: "Batch extraction attempt failed.",
              meta: {
                providerName: runtime.provider.name,
                modelName,
                batchNumber,
                error: error instanceof Error ? error.message : String(error),
              },
            });
          }
        }

        if (!batchSucceeded) {
          throw createStudentFailure({
            fallbackMessage: `Failed to extract batch ${batchNumber}/${batches.length} from the configured AI provider.`,
            statusCode: 502,
            code: "BATCH_EXTRACTION_FAILED",
            details: {
              providerName: runtime.provider.name,
              batchNumber,
              batchCount: batches.length,
            },
            cause: batchError,
          });
        }

        return [];
        }
      );

      for (const normalized of batchOutputs) {
        for (const item of normalized) {
          mergeStudentAnswer(resultsMap, item);
        }
      }

      const finalResults = questions.map((q) => {
        const found = resultsMap.get(q.id);
        return (
          found ?? {
            questionNumber: q.id,
            questionText: q.text || "",
            studentAnswer: "",
          }
        );
      });

      if (rescueEnabled && rescueLimit > 0) {
        const missing = finalResults
          .filter((row) => !String(row.studentAnswer || "").trim())
          .slice(0, rescueLimit);

        if (missing.length) {
          logger?.({
            stage: "missing.rescue.start",
            message: "Rescuing missing handwritten answers using per-question extraction.",
            meta: {
              providerName: runtime.provider.name,
              missingCount: missing.length,
              rescueLimit,
            },
          });

          const rescuedRows = await mapWithConcurrency(
            missing,
            STUDENT_RESCUE_CONCURRENCY,
            async (row) => {
            const q = questions.find((qq) => qq.id === row.questionNumber);
            const prompt = buildSingleQuestionPrompt({
              questionNumber: row.questionNumber,
              questionText: q?.text || row.questionText || "",
              questionLabel: q?.label,
            });

            let rescued: { questionNumber: number; questionText: string; studentAnswer: string } | null =
              null;
            for (const modelName of runtime.models) {
              try {
                const raw = await generateParsedModelOutput({
                  provider: runtime.provider,
                  modelName,
                  prompt,
                  fileParts,
                  logger,
                });
                const normalized = normalizeSingleStudentPayload(
                  raw,
                  row.questionNumber
                );
                if (normalized.studentAnswer.trim()) {
                  rescued = normalized;
                  break;
                }
              } catch (e) {
                lastError = e;
                continue;
              }
            }

            return { row, rescued };
            }
          );

          for (const { row, rescued } of rescuedRows) {
            if (!rescued?.studentAnswer?.trim()) continue;
            mergeStudentAnswer(resultsMap, rescued);
            row.studentAnswer = rescued.studentAnswer;
            row.questionText = row.questionText || rescued.questionText;
          }

          logger?.({
            stage: "missing.rescue.done",
            message: "Missing-answer rescue completed.",
            meta: {
              providerName: runtime.provider.name,
              extractedCount: finalResults.filter((item) => item.studentAnswer.trim()).length,
            },
          });
        }
      }

      logger?.({
        stage: "batch.normalize.done",
        message: "Batch extraction normalized successfully.",
        meta: {
          providerName: runtime.provider.name,
          questionCount: finalResults.length,
          extractedCount: finalResults.filter((item) => item.studentAnswer.trim()).length,
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
    }
  }

  if (lastError instanceof StudentExtractionError) {
    throw lastError;
  }

  throw createStudentFailure({
    fallbackMessage:
      "Student batch extraction failed after exhausting the configured model fallbacks.",
    statusCode: 502,
    code: "BATCH_EXTRACTION_FAILED",
    cause: lastError,
  });
}
