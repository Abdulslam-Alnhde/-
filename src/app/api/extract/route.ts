import { NextRequest, NextResponse } from "next/server";
import { visionModelsChain } from "@/lib/ai-models";
import { userFacingAIError } from "@/lib/ai-helpers";
import { requireAuth } from "@/lib/auth-server";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import {
  distributeEqualAmongKeyPoints,
  normalizeKeyPointsToCap,
  round2,
  sumKeyPointGrades,
} from "@/lib/exam-keypoints-normalize";
import {
  estimateNumberedQuestionCountFromText,
  shouldAcceptFastPdfExtraction,
} from "@/lib/extract-fast-path";
import { aiManager } from "@/lib/ai-manager";
import { detectMimeType, extractPdfText, prepareFileForAI } from "@/lib/ai-file-parts";
import type { AIProvider } from "@/lib/ai/provider-interface";

export const dynamic = "force-dynamic";

const CUSTOM_PROVIDER_MAX_PDF_PAGES = Math.max(
  1,
  Math.min(12, Number(process.env.CUSTOM_PROVIDER_MAX_PDF_PAGES) || 6)
);

const CUSTOM_PROVIDER_MAX_TOKENS = Math.max(
  1536,
  Math.min(8192, Number(process.env.CUSTOM_PROVIDER_MAX_TOKENS) || 4096)
);

const EXTRACT_SYSTEM_INSTRUCTION = `You extract university exam questions into structured JSON for later grading.

Return JSON only.

Rules:
- Extract 100% of visible questions and sub-questions.
- Keep question text and model answers in the exam language.
- Do NOT translate between Arabic and English. Preserve Arabic wording, punctuation, and line breaks as much as possible.
- questionType must be "OBJECTIVE" for multiple-choice, true/false, matching, fill-in-the-blank, and direct short-answer questions.
- Objective questions must use keyPoints: [] and only set questionMaxPoints.
- questionType must be "RUBRIC" for explanation, essay, definition, derivation, and multi-step questions.
- For rubric questions only, keyPoints must be in the SAME language as the model answer (Arabic if the answer is Arabic). Derive 2–8 concise grading criteria from the model answer only; do not invent facts.
- Read numbering exactly as printed. Use groupNumber for the major question and subIndex for each sub-question.
- If the paper says "Explain any N of the following", "terms", "concepts", or "definitions", emit each listed item as its own sub-question under the same groupNumber.
- The sum of defaultGrade inside one rubric question must equal questionMaxPoints when possible.
- Do not add commentary, markdown, or prose outside JSON.`;

function modelsForProvider(providerName: string): string[] {
  // Resolve models at request-time so dev env changes (AI_MODELS)
  // are reflected without relying on module init order.
  const models = visionModelsChain();
  return models.length > 0 ? models : ["grok-4-1-fast-reasoning"];
}

function jsonMimeForProvider(
  providerName: string
): "application/json" | undefined {
  return "application/json";
}

function extractSystemInstructionForProvider(providerName: string): string {
  return EXTRACT_SYSTEM_INSTRUCTION;
}

function isTimeoutLikeError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("deadline")
  );
}

function shouldSkipMonolithicExtraction(
  providerName: string,
  contentParts: Array<{ text?: string; image?: unknown; pdf?: unknown }>
) {
  const visualPartsCount = contentParts.filter(
    (part) => Boolean(part?.image) || Boolean(part?.pdf)
  ).length;
  if (visualPartsCount > 0) {
    return contentParts.length > 6;
  }

  const totalTextChars = contentParts.reduce((sum, part) => {
    return sum + (typeof part?.text === "string" ? part.text.length : 0);
  }, 0);

  // Batched extraction reserved for genuinely large prompts.
  return contentParts.length > 12 || totalTextChars > 24000;
}

function extractMaxTokensForProvider(providerName: string): number {
  return maxTokensForProvider(providerName);
}

const OBJECTIVE_TYPE_ALIASES = new Set([
  "objective",
  "mcq",
  "multiple_choice",
  "multiple choice",
  "true_false",
  "true/false",
  "true-false",
  "tf",
  "short_answer",
  "short answer",
  "fill_blank",
  "fill in the blank",
]);

const OBJECTIVE_PATTERNS = [
  /\bwhich of the following\b/i,
  /\ball of the following\b/i,
  /\bnone of the following\b/i,
  /\btrue\s*(?:\/|-|\s+or\s+)\s*false\b/i,
  /\bmultiple\s+choice\b/i,
  /\bchoose\b/i,
  /\bselect\b/i,
  /\bpick\b/i,
  /\bmatch(?:ing)?\b/i,
  /\bfill\s+in\s+the\s+blank\b/i,
  /\bchoose the correct\b/i,
  /\bselect the correct\b/i,
  /\u0635\u062d\s*\u0648\s*\u062e\u0637\u0627|\u0635\u062d\s*\u0648\s*\u062e\u0637\u0623/,
  /\u0627\u062e\u062a\u0631/,
  /\u0627\u062e\u062a\u0627\u0631\u064a/,
  /\u062d\u062f\u062f\s+\u0627\u0644\u0627\u062c\u0627\u0628\u0629\s+\u0627\u0644\u0635\u062d\u064a\u062d\u0629|\u062d\u062f\u062f\s+\u0627\u0644\u0625\u062c\u0627\u0628\u0629\s+\u0627\u0644\u0635\u062d\u064a\u062d\u0629/,
  /\u0648\u0635\u0644/,
  /\u0627\u0645\u0644\u0623/,
  /(?:^|\n)\s*[A-D][\.\)\-:]\s+\S+/m,
  /(?:^|\n)\s*[a-d][\.\)\-:]\s+\S+/m,
  // Arabic multiple-choice option lines (أ/ب/ج/د) with common separators
  /(?:^|\n)\s*[\u0623\u0627\u0628\u062a\u062b\u062c\u062d\u062e\u062f]\s*[\.\)\-:]\s+\S+/m,
  /(?:^|\n)\s*[\u0623\u0627\u0628\u062c\u062f]\s*[\.\)\-:]\s+\S+/m,
  /(?:^|\n)\s*\(\s*[\u0623\u0628\u062c\u062f]\s*\)\s+\S+/m,
  // Common Arabic objective phrasing
  /\u0636\u0639\s+\u062f\u0627\u0626\u0631\u0629|\u0636\u0639\s+\u0639\u0644\u0627\u0645\u0629|\u0627\u062e\u062a\u0631\s+\u0627\u0644\u0625\u062c\u0627\u0628\u0629|\u0627\u062e\u062a\u0627\u0631\s+\u0627\u0644\u0625\u062c\u0627\u0628\u0629|\u0627\u0643\u062a\u0628\s+\u0635\u062d|\u0627\u0643\u062a\u0628\s+\u062e\u0637\u0623/,
  // Fill in the blank (underscores / blanks)
  /_{2,}|…{2,}|\[\s*\]/,
];

const CONCEPT_LIST_PATTERNS = [
  /\bexplain any\b/i,
  /\blist of concepts\b/i,
  /\bconcepts?\b/i,
  /\bterms?\b/i,
  /\bdefinitions?\b/i,
  /\u0627\u0634\u0631\u062d/,
  /\u0627\u0644\u0645\u0635\u0637\u0644\u062d\u0627\u062a/,
  /\u0627\u0644\u0645\u0641\u0627\u0647\u064a\u0645/,
  /\u0639\u0631\u0641/,
];

const SHORT_ANSWER_PROMPT_PATTERNS = [
  /\bmention\b/i,
  /\blist\b/i,
  /\bname\b/i,
  /\bstate\b/i,
  /\bwrite\b/i,
  /\bdefine\b/i,
  /\bgive\s+\d+\b/i,
  /\bprovide\s+\d+\b/i,
  /\bidentify\b/i,
  /\bfill\b/i,
  /\u0627\u0630\u0643\u0631/, // اذكر
  /\u0639\u062f\u062f/, // عدد
  /\u0633\u0645/, // سمّ
  /\u0627\u0643\u062a\u0628/, // اكتب
  /\u0639\u0631\u0641/, // عرف
  /\u062d\u062f\u062f/, // حدد
];

const RUBRIC_PROMPT_PATTERNS = [
  /\bexplain\b/i,
  /\bjustify\b/i,
  /\bderive\b/i,
  /\bprove\b/i,
  /\bshow\b/i,
  /\bdiscuss\b/i,
  /\bcompare\b/i,
  /\u0627\u0634\u0631\u062d/, // اشرح
  /\u0641\u0633\u0631/, // فسر
  /\u0639\u0644\u0644/, // علل
  /\u0627\u0633\u062a\u0646\u062a\u062c/, // استنتج
  /\u0627\u062b\u0628\u062a/, // اثبت
  /\u0628\u064a\u0651\u0646/, // بيّن
  /\u0642\u0627\u0631\u0646/, // قارن
];

function splitLikelyAnswerItems(answer: string): string[] {
  const text = String(answer || "").trim();
  if (!text) return [];
  // Split by punctuation and conjunctions (English/Arabic)
  const parts = text
    .split(/[\n,،؛;]|(?:\band\b)|(?:\bor\b)|\s+\u0648\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  // De-dup small repeats
  return Array.from(new Set(parts)).filter((p) => p.length >= 2);
}

const MAX_RUBRIC_KEY_POINTS = 10;
const LONG_SINGLE_KEY_POINT = 160;

/** Split a model answer into rubric lines when the model did not return keyPoints (esp. Arabic prose). */
function segmentModelAnswerIntoKeyPointStrings(text: string): string[] {
  const t = String(text ?? "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return [];

  const rawLines = String(text ?? "")
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const numbered = rawLines.filter((line) =>
    /^(?:\d+|[\u0660-\u0669]+)[\.\)\-:]\s+\S/.test(line)
  );
  if (numbered.length >= 2) {
    return numbered
      .map((line) =>
        line.replace(/^(?:\d+|[\u0660-\u0669]+)[\.\)\-:]\s+/, "").trim()
      )
      .filter((p) => p.length >= 8)
      .slice(0, MAX_RUBRIC_KEY_POINTS);
  }

  if (rawLines.length >= 2 && rawLines.every((l) => l.length >= 12)) {
    return rawLines.slice(0, MAX_RUBRIC_KEY_POINTS);
  }

  const sentences = t
    .split(/(?<=[\.!\?\u061f])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 18);
  if (sentences.length >= 2) {
    return sentences.slice(0, MAX_RUBRIC_KEY_POINTS);
  }

  const clauses = t
    .split(/[،؛;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  if (clauses.length >= 2) {
    return clauses.slice(0, MAX_RUBRIC_KEY_POINTS);
  }

  if (t.length <= LONG_SINGLE_KEY_POINT) return [t];

  const chunks: string[] = [];
  let rest = t;
  const maxChunk = 220;
  while (rest.length > maxChunk) {
    const slice = rest.slice(0, maxChunk);
    const lastSpace = slice.lastIndexOf(" ");
    const cut = lastSpace > 50 ? lastSpace : maxChunk;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.slice(0, MAX_RUBRIC_KEY_POINTS);
}

/**
 * Ensure rubric questions have multiple key points when the answer supports it
 * (fixes empty/single-blob extraction for essay-style answers).
 */
function expandRubricKeyPointsFromModelAnswer(
  keyPoints: { point: string; defaultGrade: number }[],
  modelAnswer: string
): { point: string; defaultGrade: number }[] {
  const cleaned = keyPoints
    .map((k) => ({
      point: String(k.point ?? "").trim(),
      defaultGrade: round2(Number(k.defaultGrade) || 0),
    }))
    .filter((k) => k.point.length > 0);

  const answer = String(modelAnswer ?? "").trim();
  const segments =
    answer.length > 0 ? segmentModelAnswerIntoKeyPointStrings(answer) : [];

  if (cleaned.length >= 2) return cleaned;

  const singleShortOk =
    cleaned.length === 1 && cleaned[0].point.length <= LONG_SINGLE_KEY_POINT;
  if (singleShortOk && segments.length <= 1) return cleaned;

  if (segments.length >= 2) {
    const base = segments.map((point) => ({ point, defaultGrade: 1 }));
    return distributeEqualAmongKeyPoints(base, base.length);
  }

  if (cleaned.length >= 1) return cleaned;
  if (segments.length === 1) {
    return [{ point: segments[0], defaultGrade: 1 }];
  }
  return cleaned;
}

function mapKeyPointsRaw(raw: any[]): { point: string; defaultGrade: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => ({
    point: String(k?.point ?? ""),
    defaultGrade: Number(k?.defaultGrade ?? k?.grade ?? 0) || 0,
  }));
}

function readTextCandidate(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => readTextCandidate(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      readTextCandidate(obj.text) ||
      readTextCandidate(obj.value) ||
      readTextCandidate(obj.answer) ||
      readTextCandidate(obj.label) ||
      readTextCandidate(obj.content)
    );
  }
  return "";
}

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    const text = readTextCandidate(value);
    if (text) return text;
  }
  return "";
}

function extractQuestionText(raw: any): string {
  return firstNonEmptyText(
    raw?.question,
    raw?.questionText,
    raw?.text,
    raw?.prompt,
    raw?.stem,
    raw?.body,
    raw?.title
  );
}

function extractModelAnswer(raw: any): string {
  const direct = firstNonEmptyText(
    raw?.modelAnswer,
    raw?.model_answer,
    raw?.answer,
    raw?.answerText,
    raw?.sampleAnswer,
    raw?.sample_answer,
    raw?.answerKey,
    raw?.answer_key,
    raw?.correctAnswer,
    raw?.correct_answer,
    raw?.expectedAnswer,
    raw?.expected_answer,
    raw?.idealAnswer,
    raw?.referenceAnswer,
    raw?.reference_answer,
    raw?.solution,
    raw?.solutionText
  );
  if (direct) return direct;

  const objective = firstNonEmptyText(
    raw?.correctOption,
    raw?.correctChoice,
    raw?.correct,
    raw?.rightAnswer
  );
  if (objective) return objective;

  return mapKeyPointsRaw(raw?.keyPoints)
    .map((kp) => kp.point.trim())
    .filter(Boolean)
    .join("\n");
}

function finiteMax(n: unknown): number | undefined {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : undefined;
}

function parseNumericLabel(
  value: unknown
): { groupNumber?: number; subIndex?: number } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const groupNumber = Number(match[1]);
  const subIndex = match[2] ? Number(match[2]) : undefined;
  return {
    ...(Number.isFinite(groupNumber) && groupNumber >= 1
      ? { groupNumber }
      : {}),
    ...(typeof subIndex === "number" &&
    Number.isFinite(subIndex) &&
    subIndex >= 1
      ? { subIndex }
      : {}),
  };
}

function resolveNumbering(
  raw: any,
  fallbackGroupNumber: number,
  fallbackSubIndex: number
) {
  const parsed =
    parseNumericLabel(raw?.displayLabel) ??
    parseNumericLabel(raw?.label) ??
    parseNumericLabel(raw?.questionNumber) ??
    parseNumericLabel(raw?.numbering);

  const groupNumber =
    parsed?.groupNumber ??
    (Number(raw?.groupNumber ?? raw?.number) || undefined) ??
    fallbackGroupNumber;
  const subIndex =
    parsed?.subIndex ??
    (Number(raw?.subIndex ?? raw?.index) || undefined) ??
    fallbackSubIndex;

  return {
    groupNumber:
      Number.isFinite(groupNumber) && groupNumber >= 1
        ? groupNumber
        : fallbackGroupNumber,
    subIndex:
      Number.isFinite(subIndex) && subIndex >= 1
        ? subIndex
        : fallbackSubIndex,
  };
}

function isObjectiveQuestion(raw: any, question: string, modelAnswer: string) {
  const explicitType = String(raw?.questionType ?? raw?.type ?? "")
    .trim()
    .toLowerCase();
  if (OBJECTIVE_TYPE_ALIASES.has(explicitType)) return true;

  if (
    Array.isArray(raw?.options) ||
    Array.isArray(raw?.choices) ||
    Array.isArray(raw?.answers)
  ) {
    return true;
  }

  const answer = String(modelAnswer || "").trim();
  // Single-letter / single-token answers are very likely objective (MCQ/TF)
  if (
    /^[A-D]$/i.test(answer) ||
    /^[\u0623\u0627\u0628\u062c\u062f]$/.test(answer) || // أ/ا/ب/ج/د
    /^(true|false)$/i.test(answer) ||
    /^(صح|خطأ|صحيح|خطا|خطأ)$/i.test(answer)
  ) {
    return true;
  }

  // Short-answer prompts: treat as objective (no keyPoints) unless explicitly rubric-like.
  // This covers "mention/list/name/state/اذكر/عدد..." questions that don't need rubric keypoints.
  const q = String(question || "").trim();
  const qLower = q.toLowerCase();
  const aLen = answer.length;
  const looksRubric = RUBRIC_PROMPT_PATTERNS.some((p) => p.test(qLower));
  const looksShortAnswerPrompt = SHORT_ANSWER_PROMPT_PATTERNS.some((p) =>
    p.test(qLower)
  );
  if (!looksRubric && looksShortAnswerPrompt) {
    // If the question asks for multiple items and the model answer contains multiple items,
    // it's better graded as RUBRIC (keyPoints), not OBJECTIVE.
    const requestedCount = (() => {
      const m = qLower.match(/\b(?:mention|list|name|state|give|provide)\s+(\d+)\b/i);
      if (m) return Number(m[1]) || undefined;
      const ar = qLower.match(/(\d+)\s+(?:\u0639\u0646\u0627\u0635\u0631|\u0646\u0642\u0627\u0637|\u0645\u0631\u0627\u062d\u0644|\u0627\u0645\u0648\u0631|\u0623\u0634\u064a\u0627\u0621)/);
      if (ar) return Number(ar[1]) || undefined;
      return undefined;
    })();
    const items = splitLikelyAnswerItems(answer);
    if (
      (requestedCount != null && requestedCount >= 2 && items.length >= 2) ||
      items.length >= 3
    ) {
      return false; // RUBRIC
    }

    // Otherwise, a short direct answer is likely objective.
    if (aLen > 0 && aLen <= 220) return true;
  }

  const haystack = `${question}\n${modelAnswer}`.trim();
  return OBJECTIVE_PATTERNS.some((pattern) => pattern.test(haystack));
}

function deriveQuestionMaxPoints(params: {
  rawMaxPoints: number | undefined;
  keyPoints: { point: string; defaultGrade: number }[];
  questionType: "RUBRIC" | "OBJECTIVE";
}) {
  const { rawMaxPoints, keyPoints, questionType } = params;
  if (rawMaxPoints != null) return rawMaxPoints;
  const keyPointSum = round2(sumKeyPointGrades(keyPoints));
  if (keyPointSum > 0) return keyPointSum;
  if (questionType === "OBJECTIVE") return 1;
  return undefined;
}

function buildKeyPointsForQuestion(
  raw: any
): { point: string; defaultGrade: number }[] {
  let keyPoints = mapKeyPointsRaw(raw?.keyPoints);

  if (keyPoints.length === 0) {
    const text = extractModelAnswer(raw);
    const parts = text
      // Split by English/Arabic punctuation and common conjunctions
      .split(/[,،؛;]|\band\b|\s+\u0648\s+/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);

    if (parts.length > 1) {
      keyPoints = parts.map((p) => ({ point: p, defaultGrade: 1 }));
    } else if (text.length > 0) {
      keyPoints = [{ point: text, defaultGrade: 1 }];
    }
  }

  return keyPoints.map((k) => ({
    point: k.point.trim(),
    defaultGrade: round2(Number(k.defaultGrade) || 0),
  }));
}

function buildNormalizedQuestion(
  raw: any,
  fallbackGroupNumber: number,
  fallbackSubIndex: number,
  zeroBasedIndex: number
) {
  const question = extractQuestionText(raw);
  const modelAnswer = extractModelAnswer(raw);
  let keyPoints = buildKeyPointsForQuestion(raw);
  const questionType = isObjectiveQuestion(raw, question, modelAnswer)
    ? "OBJECTIVE"
    : "RUBRIC";
  if (questionType === "RUBRIC") {
    keyPoints = expandRubricKeyPointsFromModelAnswer(keyPoints, modelAnswer);
  }
  const questionMaxPoints = deriveQuestionMaxPoints({
    rawMaxPoints: finiteMax(
      raw?.questionMaxPoints ??
        raw?.maxPoints ??
        raw?.points ??
        raw?.mark ??
        raw?.marks ??
        raw?.grade
    ),
    keyPoints,
    questionType,
  });
  const numbering = resolveNumbering(raw, fallbackGroupNumber, fallbackSubIndex);

  return {
    question,
    modelAnswer,
    keyPoints:
      questionType === "OBJECTIVE"
        ? []
        : questionMaxPoints != null
          ? normalizeKeyPointsToCap(keyPoints, questionMaxPoints)
          : keyPoints,
    questionType,
    groupNumber: numbering.groupNumber,
    subIndex: numbering.subIndex,
    ...(questionMaxPoints != null ? { questionMaxPoints } : {}),
    displayLabel: getQuestionDisplayLabel(numbering, zeroBasedIndex),
    teacherNote: "",
  };
}

function extractNumberedEntries(text: string): string[] {
  const normalized = String(text ?? "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const entries: string[] = [];
  const pattern =
    /(?:^|\n)\s*(\d+)[\.\)\-:]\s+([\s\S]*?)(?=(?:\n\s*\d+[\.\)\-:]\s+)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const entry = String(match[2] ?? "").trim();
    if (entry) entries.push(entry);
  }

  return entries;
}

function requestedSelectableCount(questionText: string): number | undefined {
  const english = questionText.match(/\bany\s+(\d+)\b/i);
  if (english) return Number(english[1]) || undefined;
  const arabic = questionText.match(/(\d+)\s+\u0645\u0646/);
  if (arabic) return Number(arabic[1]) || undefined;
  return undefined;
}

function questionTitleFromConceptEntry(entry: string): string {
  const firstLine = entry.split("\n")[0]?.trim() ?? "";
  const head = firstLine.split(/\s*[:\-]\s*/, 2)[0]?.trim() ?? "";
  if (head && head.length <= 90) return head;
  return firstLine || entry;
}

function determineConceptEntryPoints(
  question: { question: string; questionMaxPoints?: number },
  entryCount: number
): number {
  const total = finiteMax(question.questionMaxPoints);
  const selectable = requestedSelectableCount(question.question);
  if (selectable && total != null && Math.abs(total - selectable) <= 1) {
    return 1;
  }
  if (total != null && total > 0) {
    if (total <= 1.5 && entryCount >= 3) return 1;
    return Math.max(0.25, round2(total / entryCount));
  }
  return 1;
}

function expandBundledConceptQuestion(question: any): any[] {
  if (question.questionType === "OBJECTIVE") return [question];
  if (!CONCEPT_LIST_PATTERNS.some((pattern) => pattern.test(question.question))) {
    return [question];
  }

  const numberedAnswers = extractNumberedEntries(question.modelAnswer);
  if (numberedAnswers.length < 3) return [question];

  const perEntryPoints = determineConceptEntryPoints(
    question,
    numberedAnswers.length
  );
  const baseGroupNumber =
    Number(question.groupNumber) > 0 ? Number(question.groupNumber) : 1;

  return numberedAnswers.map((entry, index) => ({
    question: questionTitleFromConceptEntry(entry),
    modelAnswer: entry,
    keyPoints: [{ point: entry, defaultGrade: perEntryPoints }],
    questionType: "RUBRIC" as const,
    groupNumber: baseGroupNumber,
    subIndex: index + 1,
    questionMaxPoints: perEntryPoints,
    teacherNote: question.teacherNote || "",
  }));
}

function postProcessQuestions(questions: any[]) {
  const expanded = questions.flatMap((question) =>
    expandBundledConceptQuestion(question)
  );

  return expanded.map((question, index) => ({
    ...question,
    displayLabel: getQuestionDisplayLabel(question, index),
  }));
}

function normalizeExtractPayload(data: any) {
  let title = "";
  let rawQuestions: any[] = [];

  if (Array.isArray(data)) {
    rawQuestions = data;
  } else if (data && typeof data === "object") {
    title = typeof data.title === "string" ? data.title : "";
    if (Array.isArray(data.questions)) {
      rawQuestions = data.questions;
    } else if (Array.isArray(data.questionGroups)) {
      const out: any[] = [];
      for (const g of data.questionGroups) {
        const gn = Number(g.groupNumber ?? g.number) || 1;
        const subs = g.subQuestions || g.items || [];
        subs.forEach((sub: any, j: number) => {
          const si = subs.length === 1 ? 1 : Number(sub.subIndex ?? j + 1);
          out.push(buildNormalizedQuestion(sub, gn, si, out.length));
        });
      }
      return { title, questions: postProcessQuestions(out) };
    }
  }

  if (rawQuestions.length === 0) return { title, questions: [] };

  const out: any[] = [];
  let lastGroupNum = -1;
  let currentSubIdx = 0;

  for (let i = 0; i < rawQuestions.length; i += 1) {
    const item = rawQuestions[i];
    if (!item || typeof item !== "object") continue;

    const subs =
      item.subQuestions || item.sub_questions || item.parts || item.items;

    if (Array.isArray(subs) && subs.length > 0) {
      const groupNumber = Number(item.groupNumber ?? item.number) || i + 1;
      subs.forEach((sub: any, j: number) => {
        const subIndex = Number(sub.subIndex ?? sub.index ?? j + 1);
        out.push(
          buildNormalizedQuestion(sub, groupNumber, subIndex, out.length)
        );
      });
      continue;
    }

    const groupNumber = Number(item.groupNumber ?? item.number) || i + 1;
    if (groupNumber === lastGroupNum) currentSubIdx += 1;
    else {
      lastGroupNum = groupNumber;
      currentSubIdx = Number(item.subIndex ?? item.index) || 1;
    }

    out.push(
      buildNormalizedQuestion(item, groupNumber, currentSubIdx, out.length)
    );
  }

  return { title, questions: postProcessQuestions(out) };
}

function stripJsonWrappers(rawResponse: string): string {
  return String(rawResponse ?? "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .trim();
}

function findFirstJsonBlock(text: string): string | null {
  const source = stripJsonWrappers(text);

  for (let i = 0; i < source.length; i += 1) {
    const opener = source[i];
    if (opener !== "{" && opener !== "[") continue;

    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === opener) depth += 1;
      else if (ch === closer) {
        depth -= 1;
        if (depth === 0) {
          return source.slice(i, j + 1).trim();
        }
      }
    }
  }

  return null;
}

function parsePossiblyWrappedJson(rawResponse: string): any {
  const cleanResponse = stripJsonWrappers(rawResponse);

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
      // continue to substring extraction
    }
  }

  const jsonBlock = findFirstJsonBlock(cleanResponse);
  if (!jsonBlock) {
    throw new Error("No valid JSON block was found in the model response.");
  }

  return tryParse(jsonBlock);
}

async function repairExtractResponseJson(params: {
  provider: AIProvider;
  modelName: string;
  rawResponse: string;
}) {
  const { provider, modelName, rawResponse } = params;
  const repairPrompt = `Convert the following model output into strict valid JSON only.

Rules:
- Preserve extracted questions and answers as much as possible.
- Return one JSON object with keys "title" and "questions".
- If the content is a bare questions array, wrap it as {"title":"","questions":[...]}.
- Do not add commentary or markdown.

MODEL OUTPUT:
${rawResponse}`;

  const repaired = await provider.generateContent([{ text: repairPrompt }], {
    model: modelName,
    temperature: 0,
    maxTokens: Math.min(3072, CUSTOM_PROVIDER_MAX_TOKENS),
    responseMimeType: jsonMimeForProvider(provider.name),
  });

  return parsePossiblyWrappedJson(repaired.text || "");
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    out.push(items.slice(i, i + batchSize));
  }
  return out;
}

function questionIdentityKey(question: any): string {
  const g = Number(question?.groupNumber);
  const s = Number(question?.subIndex);
  if (Number.isFinite(g) && g >= 1 && Number.isFinite(s) && s >= 1) {
    return `n:${g}.${s}`;
  }
  const text = String(question?.question || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `t:${text}`;
}

function scoreQuestionCompleteness(question: any): number {
  let score = 0;
  const qText = String(question?.question || "").trim();
  const ans = String(question?.modelAnswer || "").trim();
  if (qText.length > 6) score += 2;
  if (ans.length > 0) score += 3;
  if (ans.length > 30) score += 1;
  if (question?.questionType === "OBJECTIVE") score += 1;
  if (Number(question?.questionMaxPoints) > 0) score += 1;
  return score;
}

function mergeQuestionArrays(base: any[], incoming: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const question of [...base, ...incoming]) {
    const key = questionIdentityKey(question);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, question);
      continue;
    }
    const keepIncoming =
      scoreQuestionCompleteness(question) > scoreQuestionCompleteness(existing);
    byKey.set(key, keepIncoming ? question : existing);
  }

  const merged = Array.from(byKey.values());
  merged.sort((a, b) => {
    const ga = Number(a?.groupNumber) || 0;
    const gb = Number(b?.groupNumber) || 0;
    if (ga !== gb) return ga - gb;
    const sa = Number(a?.subIndex) || 0;
    const sb = Number(b?.subIndex) || 0;
    return sa - sb;
  });

  return merged.map((question, index) => ({
    ...question,
    displayLabel: getQuestionDisplayLabel(question, index),
  }));
}

function questionLogLabel(question: any, index: number): string {
  const rawLabel = String(
    question?.displayLabel || getQuestionDisplayLabel(question, index) || index + 1
  ).trim();
  return `Q${rawLabel}`;
}

function logQuestionProgress(prefix: string, questions: any[]) {
  if (!Array.isArray(questions) || questions.length === 0) return;
  const labels = questions.map((question, index) => questionLogLabel(question, index));
  console.log(`[extract-exam] ${prefix}: ${labels.join(", ")}`);
}

async function extractByPartsBatches(params: {
  provider: AIProvider;
  modelName: string;
  contentParts: any[];
}) {
  const { provider, modelName, contentParts } = params;
  const textOrImageParts = contentParts.filter(
    (part) => Boolean(part?.text) || Boolean(part?.image) || Boolean(part?.pdf)
  );
  if (textOrImageParts.length === 0) {
    throw new Error("No content parts were available for batch extraction.");
  }

  const batchSize = Math.max(
    1,
    Math.min(
      4,
      Number(process.env.EXTRACT_PART_BATCH_SIZE) || 2
    )
  );
  const batches = splitIntoBatches(textOrImageParts, batchSize);
  let mergedQuestions: any[] = [];
  let mergedTitle = "";

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const batchPrompt = `Extract exam questions from this batch only.

Batch ${i + 1}/${batches.length}:
Extract only questions that explicitly appear in this batch.
Never invent questions not visible in the provided content parts.
If an answer is missing in this batch, return an empty string.`;

    const result = await provider.generateContent(
      [{ text: batchPrompt }, ...batch],
      {
        model: modelName,
        systemInstruction: extractSystemInstructionForProvider(provider.name),
        temperature: 0,
        maxTokens: extractMaxTokensForProvider(provider.name),
        responseMimeType: jsonMimeForProvider(provider.name),
      }
    );

    let parsed: any;
    try {
      parsed = parsePossiblyWrappedJson(result.text || "");
    } catch {
      parsed = await repairExtractResponseJson({
        provider,
        modelName,
        rawResponse: result.text || "",
      });
    }

    const normalized = normalizeExtractPayload(parsed);
    if (!mergedTitle && String(normalized.title || "").trim()) {
      mergedTitle = String(normalized.title).trim();
    }
    if (Array.isArray(normalized.questions) && normalized.questions.length > 0) {
      logQuestionProgress(
        `Batch ${i + 1}/${batches.length} extracted`,
        normalized.questions
      );
      mergedQuestions = mergeQuestionArrays(mergedQuestions, normalized.questions);
      logQuestionProgress(
        `Accumulated after batch ${i + 1}/${batches.length}`,
        mergedQuestions
      );
    }
  }

  return {
    title: mergedTitle,
    questions: mergedQuestions,
  };
}

function normalizeAnswerFillPayload(data: any): Array<{
  groupNumber: number;
  subIndex: number;
  modelAnswer: string;
}> {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.answers)
      ? data.answers
      : Array.isArray(data?.questions)
        ? data.questions
        : [];

  return rawItems
    .map((item: any) => {
      const numbering = resolveNumbering(item, 1, 1);
      return {
        groupNumber: numbering.groupNumber,
        subIndex: numbering.subIndex,
        modelAnswer: extractModelAnswer(item),
      };
    })
    .filter(
      (item: { groupNumber: number; subIndex: number; modelAnswer: string }) =>
        item.modelAnswer.trim().length > 0
    );
}

async function fillMissingModelAnswers(params: {
  provider: AIProvider;
  modelName: string;
  referenceFiles: File[];
  questions: any[];
}) {
  const { provider, modelName, referenceFiles, questions } = params;
  if (referenceFiles.length === 0) return questions;

  const missing = questions.filter(
    (question) => !String(question.modelAnswer || "").trim()
  );
  if (missing.length === 0) return questions;

  const parts: any[] = [
    {
      text: `Fill only the missing model answers for these already-extracted exam questions.

Return JSON only in this shape:
{"answers":[{"groupNumber":1,"subIndex":1,"modelAnswer":"string"}]}

Rules:
- Use only the uploaded reference/model-answer files.
- Keep the answer in the source language.
- Do not rewrite numbering or question text.
- If an answer truly does not exist in the reference files, leave modelAnswer as an empty string.

Missing questions:
${JSON.stringify(
  missing.map((question) => ({
    groupNumber: question.groupNumber,
    subIndex: question.subIndex,
    question: question.question,
  })),
  null,
  2
)}`,
    },
  ];

  for (const file of referenceFiles) {
    if (!(file instanceof File) || file.size <= 0) continue;
    const fileParts = await prepareFileForAI(file, {
      providerName: provider.name,
      roleLabel: "Reference file",
      maxPdfPages: provider.name === "custom" ? CUSTOM_PROVIDER_MAX_PDF_PAGES : undefined,
      preferTextOnlyForPdf: false,
    });
    parts.push(...fileParts);
  }

  try {
    const result = await provider.generateContent(parts, {
      model: modelName,
      systemInstruction:
        "You complete missing model answers for extracted exam questions. Return JSON only.",
      temperature: 0,
      maxTokens: Math.min(2048, maxTokensForProvider(provider.name)),
      responseMimeType: jsonMimeForProvider(provider.name),
    });

    const parsed = normalizeAnswerFillPayload(
      parsePossiblyWrappedJson(result.text || "")
    );
    if (parsed.length === 0) return questions;

    const answerMap = new Map(
      parsed.map((item) => [
        `${item.groupNumber}.${item.subIndex}`,
        item.modelAnswer.trim(),
      ])
    );

    return questions.map((question) => {
      const key = `${question.groupNumber}.${question.subIndex}`;
      const filled = answerMap.get(key);
      if (!filled || String(question.modelAnswer || "").trim()) return question;

      const seededQuestion = { ...question, modelAnswer: filled };
      let keyPoints =
        question.questionType === "OBJECTIVE"
          ? []
          : question.keyPoints?.length
            ? question.keyPoints
            : buildKeyPointsForQuestion(seededQuestion);
      if (question.questionType !== "OBJECTIVE") {
        keyPoints = expandRubricKeyPointsFromModelAnswer(keyPoints, filled);
      }

      return {
        ...question,
        modelAnswer: filled,
        keyPoints:
          question.questionType === "OBJECTIVE"
            ? []
            : question.questionMaxPoints != null
              ? normalizeKeyPointsToCap(keyPoints, question.questionMaxPoints)
              : keyPoints,
      };
    });
  } catch (error) {
    console.warn(
      `[extract-exam] Missing-answer fill failed via ${provider.name}/${modelName}:`,
      (error as Error).message
    );
    return questions;
  }
}

function maxTokensForProvider(providerName: string): number {
  // OpenRouter and other cloud APIs can handle larger responses
  return 12288;
}

function buildUserTaskPrompt(providerName: string): string {
  return `Extract the uploaded exam into JSON.

Required JSON shape:
{
  "title": "Exam title",
  "questions": [
    {
      "groupNumber": 1,
      "subIndex": 1,
      "questionType": "RUBRIC",
      "question": "Question text",
      "modelAnswer": "Model answer",
      "questionMaxPoints": 5,
      "keyPoints": [
        { "point": "Grading criterion in the same language as modelAnswer", "defaultGrade": 2.5 },
        { "point": "Second criterion from the model answer only", "defaultGrade": 2.5 }
      ]
    }
  ]
}

Important:
- Preserve the original language of the exam (Arabic stays Arabic). Do NOT translate title/question/modelAnswer.
- If a question is objective, use questionType: "OBJECTIVE" and keyPoints: [].
- For RUBRIC questions, provide 2+ keyPoints in the same language as modelAnswer, summing defaultGrade to questionMaxPoints when possible.
- If a major question contains multiple listed terms or items, split them into separate sub-questions.
- Read numbering exactly from the paper.
- Never invent questions or answers not present in the uploaded exam file.
- If a field is unknown, return an empty string instead of fabrication.
- Return JSON only.`;
}

function normalizeExtractedPdfText(raw: string): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/\t/g, "")
    .replace(/\r/g, "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromPdfText(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] || "";
}

function parseObjectiveQuestionsFromText(text: string) {
  const questions: any[] = [];
  const lines = String(text ?? "").split("\n").map((line) => line.trim());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const questionMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (!questionMatch) continue;

    let nextLineIndex = i + 1;
    while (nextLineIndex < lines.length && !lines[nextLineIndex]) {
      nextLineIndex += 1;
    }

    const answerLine = lines[nextLineIndex] || "";
    const firstCodePoint = answerLine.codePointAt(0);
    const colonIndex = answerLine.indexOf(":");
    if (
      (firstCodePoint !== 0x25cf && firstCodePoint !== 0x2022) ||
      colonIndex === -1
    ) {
      continue;
    }

    const subIndex = Number(questionMatch[1]);
    const question = String(questionMatch[2] || "").replace(/\s+/g, " ").trim();
    const modelAnswer = answerLine.slice(colonIndex + 1).replace(/\s+/g, " ").trim();
    if (!question || !modelAnswer) continue;

    questions.push({
      groupNumber: 1,
      subIndex,
      questionType: "OBJECTIVE" as const,
      question,
      modelAnswer,
      questionMaxPoints: 1,
      keyPoints: [],
      teacherNote: "",
    });
  }

  return questions;
}

function parseRubricQuestionsFromText(text: string) {
  const explainIndex = text.search(/Explain any\s*\d+|\u0627\u0634\u0631\u062d\s*\d*\s*\u0645\u0646/i);
  if (explainIndex === -1) return [];

  const sectionText = text.slice(explainIndex);
  const questions: any[] = [];
  const pattern =
    /(?:^|\n)\s*(\d+)\.\s+([^:\n]+?)\s*:\s*([\s\S]*?)(?=(?:\n\s*\d+\.\s+)|$)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sectionText)) !== null) {
    const subIndex = Number(match[1]);
    const question = String(match[2] || "").replace(/\s+/g, " ").trim();
    const modelAnswer = String(match[3] || "").replace(/\s+/g, " ").trim();
    if (!question || !modelAnswer) continue;

    questions.push({
      groupNumber: 2,
      subIndex,
      questionType: "RUBRIC" as const,
      question,
      modelAnswer,
      questionMaxPoints: 1,
      keyPoints: [],
      teacherNote: "",
    });
  }

  return questions;
}

async function tryFastPdfTextExtraction(examFiles: File[]) {
  if (examFiles.length !== 1) return null;
  const file = examFiles[0];
  if (detectMimeType(file) !== "application/pdf") return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawText = await extractPdfText(buffer);
  if (!rawText.trim()) return null;

  const normalizedText = normalizeExtractedPdfText(rawText);
  const objective = parseObjectiveQuestionsFromText(normalizedText);
  const rubric = parseRubricQuestionsFromText(normalizedText);
  const parsedQuestions = [...objective, ...rubric];

  if (
    !shouldAcceptFastPdfExtraction({
      normalizedText,
      parsedQuestions,
    })
  ) {
    console.log(
      `[extract-exam] Fast PDF text extraction skipped: extracted ${parsedQuestions.length} candidate question(s) from ${estimateNumberedQuestionCountFromText(
        normalizedText
      )} numbered line(s)`
    );
    return null;
  }

  const questions = postProcessQuestions(parsedQuestions);
  logQuestionProgress("Fast PDF text extraction", questions);
  return {
    title: titleFromPdfText(normalizedText),
    questions,
  };
}
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const multi = formData.getAll("examFiles") as File[];
    const legacy = formData.get("examFile") as File | null;
    const referenceFiles = formData.getAll("referenceFiles") as File[];

    const examFiles: File[] = [];
    for (const f of multi) {
      if (f instanceof File && f.size > 0) examFiles.push(f);
    }
    if (examFiles.length === 0 && legacy instanceof File && legacy.size > 0) {
      examFiles.push(legacy);
    }

    if (examFiles.length === 0) {
      return NextResponse.json(
        { error: "لم يتم رفع أي ملف للاختبار." },
        { status: 400 }
      );
    }

    const fastPdfResult = await tryFastPdfTextExtraction(examFiles);
    if (fastPdfResult) {
      console.log("[extract-exam] Fast PDF text extraction succeeded without model call");
      return NextResponse.json(fastPdfResult);
    }

    const providers = aiManager.getProviderChain();
    let lastError: unknown = null;

    providerLoop: for (const provider of providers) {
      const userTaskPrompt = buildUserTaskPrompt(provider.name);
      const aiParts: any[] = [{ text: userTaskPrompt }];

      for (const examFile of examFiles) {
        const parts = await prepareFileForAI(examFile, {
          providerName: provider.name,
          roleLabel: "Exam file",
          maxPdfPages:
            provider.name === "custom" ? CUSTOM_PROVIDER_MAX_PDF_PAGES : undefined,
          preferTextOnlyForPdf: false,
        });
        console.log(
          `[extract-exam] Prepared ${examFile.name} into ${parts.length} AI part(s) for ${provider.name}`
        );
        aiParts.push(...parts);
      }

      const providerModels = modelsForProvider(provider.name);

      for (const modelName of providerModels) {
        let attemptedBatchedFirst = false;
        try {
          console.log(
            `[extract-exam] Trying model: ${modelName} via ${provider.name}`
          );

          if (shouldSkipMonolithicExtraction(provider.name, aiParts.slice(1))) {
            attemptedBatchedFirst = true;
            console.log(
              `[extract-exam] Using batched extraction first for ${modelName} via ${provider.name}`
            );
            const fallback = await extractByPartsBatches({
              provider,
              modelName,
              contentParts: aiParts.slice(1),
            });

            if (Array.isArray(fallback.questions) && fallback.questions.length > 0) {
              fallback.questions = await fillMissingModelAnswers({
                provider,
                modelName,
                referenceFiles,
                questions: fallback.questions,
              });
              logQuestionProgress("Final extracted questions", fallback.questions);
              console.log(
                `[extract-exam] Batched-first extraction succeeded with model: ${modelName}`
              );
              return NextResponse.json(fallback);
            }
          }

          const result = await provider.generateContent(aiParts, {
            model: modelName,
            systemInstruction: extractSystemInstructionForProvider(provider.name),
            temperature: 0,
            maxTokens: extractMaxTokensForProvider(provider.name),
            responseMimeType: jsonMimeForProvider(provider.name),
          });

          const rawResponse = result.text;
          if (!rawResponse) {
            throw new Error("The model returned an empty response.");
          }

          let parsed: any;
          try {
            parsed = parsePossiblyWrappedJson(rawResponse);
          } catch {
            console.warn(
              `[extract-exam] ${modelName} returned non-strict JSON; attempting repair`
            );
            parsed = await repairExtractResponseJson({
              provider,
              modelName,
              rawResponse,
            });
          }

          const normalized = normalizeExtractPayload(parsed);
          if (
            !Array.isArray(normalized.questions) ||
            normalized.questions.length === 0
          ) {
            throw new Error("The response was parsed but no questions were extracted.");
          }

          normalized.questions = await fillMissingModelAnswers({
            provider,
            modelName,
            referenceFiles,
            questions: normalized.questions,
          });

          logQuestionProgress("Final extracted questions", normalized.questions);
          console.log(`[extract-exam] Success with model: ${modelName}`);
          return NextResponse.json(normalized);
        } catch (error: any) {
          if (isTimeoutLikeError(error) && !attemptedBatchedFirst) {
            try {
              console.warn(
                `[extract-exam] Timeout on ${modelName} via ${provider.name}; retrying with batched extraction`
              );

              const fallback = await extractByPartsBatches({
                provider,
                modelName,
                contentParts: aiParts.slice(1),
              });

              if (Array.isArray(fallback.questions) && fallback.questions.length > 0) {
                fallback.questions = await fillMissingModelAnswers({
                  provider,
                  modelName,
                  referenceFiles,
                  questions: fallback.questions,
                });
                logQuestionProgress("Final extracted questions", fallback.questions);
                console.log(
                  `[extract-exam] Batched fallback succeeded with model: ${modelName}`
                );
                return NextResponse.json(fallback);
              }
            } catch (fallbackError: any) {
              console.error(
                `[extract-exam] Batched fallback failed for ${modelName} via ${provider.name}:`,
                fallbackError?.message || fallbackError
              );
            }
          }

          lastError = error;
          const status = error?.status || error?.code;
          console.error(
            `[extract-exam] Model ${modelName} via ${provider.name} failed:`,
            error?.message || error
          );

          if (
            status === 429 ||
            error?.message?.includes("429") ||
            error?.message?.includes("quota")
          ) {
            continue;
          }
        }
      }

      continue providerLoop;
    }

    return NextResponse.json(
      { error: userFacingAIError(lastError) },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("EXAM EXTRACTION CRITICAL ERROR:", error);

    if (error?.status === 429 || error?.message?.includes("429")) {
      return NextResponse.json(
        {
          error:
            "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية ثم المحاولة مرة أخرى.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: userFacingAIError(error) },
      { status: 500 }
    );
  }
}

