/**
 * Teacher Exam Extraction — Pipeline / Runner.
 * Heavy logic for the /api/services/extract-teacher route lives here.
 * The route file is a thin wrapper that calls `runTeacherExtraction`.
 */

import { userFacingAIError } from "@/lib/ai-helpers";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import {
  distributeEqualAmongKeyPoints,
  normalizeKeyPointsToCap,
  round2,
  sumKeyPointGrades,
} from "@/lib/exam-scoring";
import { aiManager } from "@/lib/ai-manager";
import {
  detectMimeType,
  extractPdfText,
  prepareFileForAI,
} from "@/lib/ai-file-parts";
import type { AIProvider } from "@/lib/ai/provider-interface";
import {
  TEACHER_EXTRACT_SYSTEM_INSTRUCTION,
  TEACHER_FILL_SYSTEM_INSTRUCTION,
  buildTeacherBatchPrompt,
  buildTeacherFillMissingAnswersPrompt,
  buildTeacherJsonRepairPrompt,
  buildTeacherStructureHint,
  buildTeacherUserTaskPrompt,
  type TeacherExpectedStructure,
} from "@/lib/ai-prompts";
import { parsePossiblyWrappedJson } from "@/lib/safe-json";

const SERVICE = "teacherExtraction" as const;

// ─── Tunables ──────────────────────────────────────────────────────────

const TEACHER_EXTRACT_MAX_TOKENS = 12288;

// ─── Fast PDF heuristics ───────────────────────────────────────────────

function estimateNumberedQuestionCountFromText(text: string): number {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+\S+/.test(line)).length;
}

function shouldAcceptFastPdfExtraction(params: {
  normalizedText: string;
  parsedQuestions: Array<{ modelAnswer?: string }>;
}) {
  const { normalizedText, parsedQuestions } = params;
  if (!Array.isArray(parsedQuestions) || parsedQuestions.length < 3) return false;

  const estimatedQuestionCount =
    estimateNumberedQuestionCountFromText(normalizedText);
  if (estimatedQuestionCount <= 0) return false;

  const answeredQuestions = parsedQuestions.filter(
    (item) => String(item?.modelAnswer || "").trim().length > 0
  ).length;
  const coverage = parsedQuestions.length / estimatedQuestionCount;
  const answerCoverage = answeredQuestions / parsedQuestions.length;

  return coverage >= 0.75 && answerCoverage >= 0.9;
}

// ─── Type heuristics ───────────────────────────────────────────────────

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
  /(?:^|\n)\s*[\u0623\u0627\u0628\u062a\u062b\u062c\u062d\u062e\u062f]\s*[\.\)\-:]\s+\S+/m,
  /(?:^|\n)\s*[\u0623\u0627\u0628\u062c\u062f]\s*[\.\)\-:]\s+\S+/m,
  /(?:^|\n)\s*\(\s*[\u0623\u0628\u062c\u062f]\s*\)\s+\S+/m,
  /\u0636\u0639\s+\u062f\u0627\u0626\u0631\u0629|\u0636\u0639\s+\u0639\u0644\u0627\u0645\u0629|\u0627\u062e\u062a\u0631\s+\u0627\u0644\u0625\u062c\u0627\u0628\u0629|\u0627\u062e\u062a\u0627\u0631\s+\u0627\u0644\u0625\u062c\u0627\u0628\u0629|\u0627\u0643\u062a\u0628\s+\u0635\u062d|\u0627\u0643\u062a\u0628\s+\u062e\u0637\u0623/,
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
  /\bmention\b/i, /\blist\b/i, /\bname\b/i, /\bstate\b/i, /\bwrite\b/i, /\bdefine\b/i,
  /\bgive\s+\d+\b/i, /\bprovide\s+\d+\b/i, /\bidentify\b/i, /\bfill\b/i,
  /\u0627\u0630\u0643\u0631/, /\u0639\u062f\u062f/, /\u0633\u0645/, /\u0627\u0643\u062a\u0628/,
  /\u0639\u0631\u0641/, /\u062d\u062f\u062f/,
];

const RUBRIC_PROMPT_PATTERNS = [
  /\bexplain\b/i, /\bjustify\b/i, /\bderive\b/i, /\bprove\b/i, /\bshow\b/i,
  /\bdiscuss\b/i, /\bcompare\b/i,
  /\u0627\u0634\u0631\u062d/, /\u0641\u0633\u0631/, /\u0639\u0644\u0644/,
  /\u0627\u0633\u062a\u0646\u062a\u062c/, /\u0627\u062b\u0628\u062a/, /\u0628\u064a\u0651\u0646/, /\u0642\u0627\u0631\u0646/,
];

// ─── Misc helpers ──────────────────────────────────────────────────────

/** يقرأ الهيكل المتوقَّع المُعلَن من المعلم من حقل multipart اختياري. */
function parseExpectedStructure(
  raw: unknown
): TeacherExpectedStructure | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const rawQuestions = Array.isArray(parsed.questions)
      ? parsed.questions
      : [];
    const questions = rawQuestions.map((q: any) => ({
      type: q?.type === "RUBRIC" ? ("RUBRIC" as const) : ("OBJECTIVE" as const),
      grade: num(q?.grade),
      subPartCount: num(q?.subPartCount),
    }));
    return {
      pageCount: num(parsed.pageCount),
      questions,
    };
  } catch {
    return null;
  }
}

function isTimeoutLikeError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || error || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("deadline")
  );
}

function shouldSkipMonolithicExtraction(
  contentParts: Array<{ text?: string; image?: unknown; pdf?: unknown }>
) {
  const visualPartsCount = contentParts.filter(
    (part) => Boolean(part?.image) || Boolean(part?.pdf)
  ).length;
  if (visualPartsCount > 0) return contentParts.length > 6;

  const totalTextChars = contentParts.reduce(
    (sum, part) => sum + (typeof part?.text === "string" ? part.text.length : 0),
    0
  );
  return contentParts.length > 12 || totalTextChars > 24000;
}

function splitLikelyAnswerItems(answer: string): string[] {
  const text = String(answer || "").trim();
  if (!text) return [];
  const parts = text
    .split(/[\n,،؛;]|(?:\band\b)|(?:\bor\b)|\s+\u0648\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).filter((p) => p.length >= 2);
}

const MAX_RUBRIC_KEY_POINTS = 10;
const LONG_SINGLE_KEY_POINT = 160;

function segmentModelAnswerIntoKeyPointStrings(text: string): string[] {
  const t = String(text ?? "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
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
  if (sentences.length >= 2) return sentences.slice(0, MAX_RUBRIC_KEY_POINTS);

  const clauses = t
    .split(/[،؛;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  if (clauses.length >= 2) return clauses.slice(0, MAX_RUBRIC_KEY_POINTS);

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
    raw?.question, raw?.questionText, raw?.text,
    raw?.prompt, raw?.stem, raw?.body, raw?.title
  );
}

function extractModelAnswer(raw: any): string {
  const direct = firstNonEmptyText(
    raw?.modelAnswer, raw?.model_answer, raw?.answer, raw?.answerText,
    raw?.sampleAnswer, raw?.sample_answer, raw?.answerKey, raw?.answer_key,
    raw?.correctAnswer, raw?.correct_answer, raw?.expectedAnswer,
    raw?.expected_answer, raw?.idealAnswer, raw?.referenceAnswer,
    raw?.reference_answer, raw?.solution, raw?.solutionText
  );
  if (direct) return direct;

  const objective = firstNonEmptyText(
    raw?.correctOption, raw?.correctChoice, raw?.correct, raw?.rightAnswer
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

function parseNumericLabel(value: unknown): { groupNumber?: number; subIndex?: number } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const groupNumber = Number(match[1]);
  const subIndex = match[2] ? Number(match[2]) : undefined;
  return {
    ...(Number.isFinite(groupNumber) && groupNumber >= 1 ? { groupNumber } : {}),
    ...(typeof subIndex === "number" && Number.isFinite(subIndex) && subIndex >= 1
      ? { subIndex }
      : {}),
  };
}

function resolveNumbering(raw: any, fallbackGroupNumber: number, fallbackSubIndex: number) {
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
      Number.isFinite(groupNumber) && groupNumber >= 1 ? groupNumber : fallbackGroupNumber,
    subIndex:
      Number.isFinite(subIndex) && subIndex >= 1 ? subIndex : fallbackSubIndex,
  };
}

function isObjectiveQuestion(raw: any, question: string, modelAnswer: string) {
  const explicitType = String(raw?.questionType ?? raw?.type ?? "").trim().toLowerCase();
  if (OBJECTIVE_TYPE_ALIASES.has(explicitType)) return true;

  if (Array.isArray(raw?.options) || Array.isArray(raw?.choices) || Array.isArray(raw?.answers)) {
    return true;
  }

  const answer = String(modelAnswer || "").trim();
  if (
    /^[A-D]$/i.test(answer) ||
    /^[\u0623\u0627\u0628\u062c\u062f]$/.test(answer) ||
    /^(true|false)$/i.test(answer) ||
    /^(صح|خطأ|صحيح|خطا|خطأ)$/i.test(answer)
  ) return true;

  const q = String(question || "").trim();
  const qLower = q.toLowerCase();
  const aLen = answer.length;
  const looksRubric = RUBRIC_PROMPT_PATTERNS.some((p) => p.test(qLower));
  const looksShortAnswerPrompt = SHORT_ANSWER_PROMPT_PATTERNS.some((p) => p.test(qLower));
  if (!looksRubric && looksShortAnswerPrompt) {
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
      return false;
    }
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

function buildKeyPointsForQuestion(raw: any): { point: string; defaultGrade: number }[] {
  let keyPoints = mapKeyPointsRaw(raw?.keyPoints);

  if (keyPoints.length === 0) {
    const text = extractModelAnswer(raw);
    const parts = text
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
  const pattern = /(?:^|\n)\s*(\d+)[\.\)\-:]\s+([\s\S]*?)(?=(?:\n\s*\d+[\.\)\-:]\s+)|$)/g;
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
  if (selectable && total != null && Math.abs(total - selectable) <= 1) return 1;
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

  const perEntryPoints = determineConceptEntryPoints(question, numberedAnswers.length);
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
  const expanded = questions.flatMap((q) => expandBundledConceptQuestion(q));
  return expanded.map((q, i) => ({
    ...q,
    displayLabel: getQuestionDisplayLabel(q, i),
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

    const subs = item.subQuestions || item.sub_questions || item.parts || item.items;
    if (Array.isArray(subs) && subs.length > 0) {
      const groupNumber = Number(item.groupNumber ?? item.number) || i + 1;
      subs.forEach((sub: any, j: number) => {
        const subIndex = Number(sub.subIndex ?? sub.index ?? j + 1);
        out.push(buildNormalizedQuestion(sub, groupNumber, subIndex, out.length));
      });
      continue;
    }

    const groupNumber = Number(item.groupNumber ?? item.number) || i + 1;
    if (groupNumber === lastGroupNum) currentSubIdx += 1;
    else {
      lastGroupNum = groupNumber;
      currentSubIdx = Number(item.subIndex ?? item.index) || 1;
    }

    out.push(buildNormalizedQuestion(item, groupNumber, currentSubIdx, out.length));
  }

  return { title, questions: postProcessQuestions(out) };
}

// ─── JSON repair (via shared safe-json parser) ─────────────────────────

async function repairExtractResponseJson(params: {
  provider: AIProvider;
  modelName: string;
  rawResponse: string;
}) {
  const { provider, modelName, rawResponse } = params;
  const repaired = await provider.generateContent(
    [{ text: buildTeacherJsonRepairPrompt(rawResponse) }],
    {
      model: modelName,
      temperature: 0,
      maxTokens: 3072,
      responseMimeType: "application/json",
    }
  );
  return parsePossiblyWrappedJson(repaired.text || "");
}

// ─── Batched extraction ────────────────────────────────────────────────

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
  if (Number.isFinite(g) && g >= 1 && Number.isFinite(s) && s >= 1) return `n:${g}.${s}`;
  const text = String(question?.question || "")
    .toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160);
  return `t:${text}`;
}

function scoreQuestionCompleteness(q: any): number {
  let score = 0;
  if (String(q?.question || "").trim().length > 6) score += 2;
  const ans = String(q?.modelAnswer || "").trim();
  if (ans.length > 0) score += 3;
  if (ans.length > 30) score += 1;
  if (q?.questionType === "OBJECTIVE") score += 1;
  if (Number(q?.questionMaxPoints) > 0) score += 1;
  return score;
}

function mergeQuestionArrays(base: any[], incoming: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const q of [...base, ...incoming]) {
    const key = questionIdentityKey(q);
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, q); continue; }
    const keepIncoming =
      scoreQuestionCompleteness(q) > scoreQuestionCompleteness(existing);
    byKey.set(key, keepIncoming ? q : existing);
  }
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => {
    const ga = Number(a?.groupNumber) || 0;
    const gb = Number(b?.groupNumber) || 0;
    if (ga !== gb) return ga - gb;
    return (Number(a?.subIndex) || 0) - (Number(b?.subIndex) || 0);
  });
  return merged.map((q, i) => ({ ...q, displayLabel: getQuestionDisplayLabel(q, i) }));
}

function questionLogLabel(q: any, i: number): string {
  const rawLabel = String(q?.displayLabel || getQuestionDisplayLabel(q, i) || i + 1).trim();
  return `Q${rawLabel}`;
}

function logQuestionProgress(prefix: string, questions: any[]) {
  if (!Array.isArray(questions) || questions.length === 0) return;
  const labels = questions.map((q, i) => questionLogLabel(q, i));
  console.log(`[extract-teacher] ${prefix}: ${labels.join(", ")}`);
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
    Math.min(4, Number(process.env.EXTRACT_PART_BATCH_SIZE) || 2)
  );
  const batches = splitIntoBatches(textOrImageParts, batchSize);
  let mergedQuestions: any[] = [];
  let mergedTitle = "";

  for (let i = 0; i < batches.length; i += 1) {
    const result = await provider.generateContent(
      [{ text: buildTeacherBatchPrompt(i, batches.length) }, ...batches[i]],
      {
        model: modelName,
        systemInstruction: TEACHER_EXTRACT_SYSTEM_INSTRUCTION,
        temperature: 0,
        maxTokens: TEACHER_EXTRACT_MAX_TOKENS,
        responseMimeType: "application/json",
      }
    );

    let parsed: any;
    try {
      parsed = parsePossiblyWrappedJson(result.text || "");
    } catch {
      parsed = await repairExtractResponseJson({
        provider, modelName, rawResponse: result.text || "",
      });
    }

    const normalized = normalizeExtractPayload(parsed);
    if (!mergedTitle && String(normalized.title || "").trim()) {
      mergedTitle = String(normalized.title).trim();
    }
    if (Array.isArray(normalized.questions) && normalized.questions.length > 0) {
      logQuestionProgress(`Batch ${i + 1}/${batches.length} extracted`, normalized.questions);
      mergedQuestions = mergeQuestionArrays(mergedQuestions, normalized.questions);
      logQuestionProgress(
        `Accumulated after batch ${i + 1}/${batches.length}`,
        mergedQuestions
      );
    }
  }

  return { title: mergedTitle, questions: mergedQuestions };
}

// ─── Missing-answer fill ───────────────────────────────────────────────

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
      (item: { modelAnswer: string }) => item.modelAnswer.trim().length > 0
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

  const missing = questions.filter((q) => !String(q.modelAnswer || "").trim());
  if (missing.length === 0) return questions;

  const parts: any[] = [
    {
      text: buildTeacherFillMissingAnswersPrompt(
        missing.map((q) => ({
          groupNumber: q.groupNumber,
          subIndex: q.subIndex,
          question: q.question,
        }))
      ),
    },
  ];

  const referenceParts = await Promise.all(
    referenceFiles
      .filter((file) => file instanceof File && file.size > 0)
      .map((file) =>
        prepareFileForAI(file, {
          providerName: provider.name,
          roleLabel: "Reference file",
          maxPdfPages: undefined,
          preferTextOnlyForPdf: true,
        })
      )
  );
  parts.push(...referenceParts.flat());

  try {
    const result = await provider.generateContent(parts, {
      model: modelName,
      systemInstruction: TEACHER_FILL_SYSTEM_INSTRUCTION,
      temperature: 0,
      maxTokens: Math.min(2048, TEACHER_EXTRACT_MAX_TOKENS),
      responseMimeType: "application/json",
    });

    const parsed = normalizeAnswerFillPayload(parsePossiblyWrappedJson(result.text || ""));
    if (parsed.length === 0) return questions;

    const answerMap = new Map(
      parsed.map((item) => [`${item.groupNumber}.${item.subIndex}`, item.modelAnswer.trim()])
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
      `[extract-teacher] Missing-answer fill failed via ${provider.name}/${modelName}:`,
      (error as Error).message
    );
    return questions;
  }
}

// ─── Fast PDF text path (no model call) ────────────────────────────────

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
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[0] || "";
}

function parseObjectiveQuestionsFromText(text: string) {
  const questions: any[] = [];
  const lines = String(text ?? "").split("\n").map((l) => l.trim());

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
    if ((firstCodePoint !== 0x25cf && firstCodePoint !== 0x2022) || colonIndex === -1) {
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
  const pattern = /(?:^|\n)\s*(\d+)\.\s+([^:\n]+?)\s*:\s*([\s\S]*?)(?=(?:\n\s*\d+\.\s+)|$)/g;

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

  if (!shouldAcceptFastPdfExtraction({ normalizedText, parsedQuestions })) {
    console.log(
      `[extract-teacher] Fast PDF text extraction skipped: extracted ${parsedQuestions.length} candidate question(s) from ${estimateNumberedQuestionCountFromText(
        normalizedText
      )} numbered line(s)`
    );
    return null;
  }

  const questions = postProcessQuestions(parsedQuestions);
  logQuestionProgress("Fast PDF text extraction", questions);
  return { title: titleFromPdfText(normalizedText), questions };
}

// ─── Public runner ─────────────────────────────────────────────────────

/** Teacher PDF extraction pipeline; auth is enforced by the API gateway (BFF + internal secret). */
export async function runTeacherExtraction(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const multi = formData.getAll("examFiles") as File[];
    const legacy = formData.get("examFile") as File | null;
    const referenceFiles = formData.getAll("referenceFiles") as File[];
    const expectedStructure = parseExpectedStructure(
      formData.get("expectedStructure")
    );

    const examFiles: File[] = [];
    for (const f of multi) {
      if (f instanceof File && f.size > 0) examFiles.push(f);
    }
    if (examFiles.length === 0 && legacy instanceof File && legacy.size > 0) {
      examFiles.push(legacy);
    }

    if (examFiles.length === 0) {
      return Response.json(
        { error: "لم يتم رفع أي ملف للاختبار." },
        { status: 400 }
      );
    }

    const fastPdfResult = await tryFastPdfTextExtraction(examFiles);
    if (fastPdfResult) {
      console.log("[extract-teacher] Fast PDF text extraction succeeded without model call");
      return Response.json(fastPdfResult);
    }

    const provider = aiManager.getServiceProvider(SERVICE);
    const providerModels = aiManager.getServiceModels(SERVICE);
    let lastError: unknown = null;

    const structureHint = buildTeacherStructureHint(expectedStructure);
    if (structureHint) {
      console.log(
        "[extract-teacher] Using teacher-declared structure as extraction template"
      );
    }
    const userTaskPrompt = buildTeacherUserTaskPrompt(structureHint);
    const aiParts: any[] = [{ text: userTaskPrompt }];

    const preparedExamFiles = await Promise.all(
      examFiles.map(async (examFile) => {
        const parts = await prepareFileForAI(examFile, {
          providerName: provider.name,
          roleLabel: "Exam file",
          maxPdfPages: undefined,
          preferTextOnlyForPdf: true,
        });
        return { examFile, parts };
      })
    );

    for (const { examFile, parts } of preparedExamFiles) {
      console.log(
        `[extract-teacher] Prepared ${examFile.name} into ${parts.length} AI part(s) for ${provider.name}`
      );
      aiParts.push(...parts);
    }

    for (const modelName of providerModels) {
      let attemptedBatchedFirst = false;
      try {
        console.log(`[extract-teacher] Trying model: ${modelName} via ${provider.name}`);

        if (shouldSkipMonolithicExtraction(aiParts.slice(1))) {
          attemptedBatchedFirst = true;
          console.log(
            `[extract-teacher] Using batched extraction first for ${modelName} via ${provider.name}`
          );
          const fallback = await extractByPartsBatches({
            provider, modelName, contentParts: aiParts.slice(1),
          });

          if (Array.isArray(fallback.questions) && fallback.questions.length > 0) {
            fallback.questions = await fillMissingModelAnswers({
              provider, modelName, referenceFiles, questions: fallback.questions,
            });
            logQuestionProgress("Final extracted questions", fallback.questions);
            console.log(
              `[extract-teacher] Batched-first extraction succeeded with model: ${modelName}`
            );
            return Response.json(fallback);
          }
        }

        const result = await provider.generateContent(aiParts, {
          model: modelName,
          systemInstruction: TEACHER_EXTRACT_SYSTEM_INSTRUCTION,
          temperature: 0,
          maxTokens: TEACHER_EXTRACT_MAX_TOKENS,
          responseMimeType: "application/json",
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
            `[extract-teacher] ${modelName} returned non-strict JSON; attempting repair`
          );
          parsed = await repairExtractResponseJson({ provider, modelName, rawResponse });
        }

        const normalized = normalizeExtractPayload(parsed);
        if (!Array.isArray(normalized.questions) || normalized.questions.length === 0) {
          throw new Error("The response was parsed but no questions were extracted.");
        }

        normalized.questions = await fillMissingModelAnswers({
          provider, modelName, referenceFiles, questions: normalized.questions,
        });

        logQuestionProgress("Final extracted questions", normalized.questions);
        console.log(`[extract-teacher] Success with model: ${modelName}`);
        return Response.json(normalized);
      } catch (error: any) {
        if (isTimeoutLikeError(error) && !attemptedBatchedFirst) {
          try {
            console.warn(
              `[extract-teacher] Timeout on ${modelName} via ${provider.name}; retrying with batched extraction`
            );

            const fallback = await extractByPartsBatches({
              provider, modelName, contentParts: aiParts.slice(1),
            });

            if (Array.isArray(fallback.questions) && fallback.questions.length > 0) {
              fallback.questions = await fillMissingModelAnswers({
                provider, modelName, referenceFiles, questions: fallback.questions,
              });
              logQuestionProgress("Final extracted questions", fallback.questions);
              console.log(
                `[extract-teacher] Batched fallback succeeded with model: ${modelName}`
              );
              return Response.json(fallback);
            }
          } catch (fallbackError: any) {
            console.error(
              `[extract-teacher] Batched fallback failed for ${modelName} via ${provider.name}:`,
              fallbackError?.message || fallbackError
            );
          }
        }

        lastError = error;
        const status = error?.status || error?.code;
        console.error(
          `[extract-teacher] Model ${modelName} via ${provider.name} failed:`,
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

    return Response.json(
      { error: userFacingAIError(lastError) },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("EXAM EXTRACTION CRITICAL ERROR:", error);

    if (error?.status === 429 || error?.message?.includes("429")) {
      return Response.json(
        { error: "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية ثم المحاولة مرة أخرى." },
        { status: 429 }
      );
    }

    return Response.json(
      { error: userFacingAIError(error) },
      { status: 500 }
    );
  }
}
