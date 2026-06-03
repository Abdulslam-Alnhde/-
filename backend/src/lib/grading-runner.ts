/**
 * Grading â€” Pipeline / Runner.
 * Heavy logic for the /api/services/grading route lives here.
 * The route file is a thin wrapper that calls `runGrading`.
 */

import {
  isTransientNetworkError,
  sleep,
  userFacingAIError,
} from "@/lib/ai-helpers";
import {
  buildGradingCachePayload,
  canonicalizeKeyPointsMeta,
  canonicalizeStudentAnswers,
  deepRound2Values,
  hasAnswerLanguageMismatch,
  round2,
} from "@/lib/exam-scoring";
import {
  getCachedGradingJson,
  gradingCacheKey,
  setCachedGradingJson,
} from "@/lib/grading-cache";
import { aiManager } from "@/lib/ai-manager";
import {
  buildGradingPrompt,
  buildSemanticRescuePrompt,
} from "@/lib/ai-prompts";
import { parsePossiblyWrappedJson as parseJsonOrThrow } from "@/lib/safe-json";

const SERVICE = "grading" as const;
const SEMANTIC_STRICT = process.env.GRADING_SEMANTIC_STRICT !== "false";

/** Ø·Ù„Ø¨Ø§Øª ØªØµØ­ÙŠØ­ Ù…ØªØ²Ø§Ù…Ù†Ø© Ù„Ù†ÙØ³ Ø§Ù„Ù…Ø¯Ø®Ù„Ø§Øª â€” Ù†ØªÙŠØ¬Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø· (ÙŠÙ‚Ù„Ù‘Ù„ Ø§Ù„ØªØ¨Ø§ÙŠÙ†) */
const inflightGrading = new Map<string, Promise<unknown>>();

class GradingHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: object
  ) {
    super("GradingHttpError");
    this.name = "GradingHttpError";
  }
}

type KeyPointRow = { point?: string; maxWeight?: number; grade?: number };

function normText(v: unknown): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .toLowerCase();
}

/** Uses teacher-defined rubric weights when present; scales them to questionMaxPoints. */
function normalizeBranchWeights(keyPointsData: any[]): any[] {
  return keyPointsData.map((meta) => {
    const qMax = Number(meta.questionMaxPoints) || 10;
    const raw = meta.keyPoints || [];
    if (raw.length === 0) {
      return {
        ...meta,
        branchCount: 1,
        pointsPerBranch: qMax,
        gradingMode: "single_branch",
        keyPoints: [
          {
            point: "Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø© Ù„Ù„Ø³Ø¤Ø§Ù„ (Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØ±ÙˆØ¹ ÙÙŠ Ø§Ù„Ù†Ù…ÙˆØ°Ø¬)",
            maxWeight: qMax,
            grade: qMax,
          },
        ],
      };
    }
    const weights = raw.map((k: any) =>
      Number(k.maxWeight ?? k.grade ?? k.defaultGrade) || 0
    );
    const sumW = weights.reduce((a: number, b: number) => a + b, 0);
    let caps: number[];
    if (sumW > 0) {
      const factor = qMax / sumW;
      caps = weights.map((w: number) => round2(w * factor));
      const newSum = caps.reduce((a: number, b: number) => a + b, 0);
      const drift = round2(qMax - newSum);
      if (caps.length && Math.abs(drift) > 1e-6) {
        caps[caps.length - 1] = round2(caps[caps.length - 1] + drift);
        if (caps[caps.length - 1] < 0) caps[caps.length - 1] = 0;
      }
    } else {
      const n = raw.length;
      const per = round2(qMax / n);
      caps = raw.map((_: any, i: number) =>
        i < n - 1 ? per : round2(qMax - per * (n - 1))
      );
    }
    const n = raw.length;
    const perBranch = n > 0 ? round2(qMax / n) : qMax;
    return {
      ...meta,
      branchCount: n,
      pointsPerBranch: perBranch,
      gradingMode: "weighted_branches",
      keyPoints: raw.map((k: any, i: number) => ({
        ...k,
        maxWeight: caps[i],
        grade: caps[i],
      })),
    };
  });
}

function questionCeiling(meta: any): number {
  if (meta == null) return 10;
  const direct = Number(meta.questionMaxPoints);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const arr: KeyPointRow[] = meta.keyPoints || [];
  const sum = arr.reduce(
    (s, k) => s + (Number(k.maxWeight ?? k.grade) || 0),
    0
  );
  return sum > 0 ? sum : 10;
}

function reconcileScores(
  breakdown: any[],
  keyPointsData: any[],
  examTotalGrade?: number
) {
  const rows = Array.isArray(breakdown) ? breakdown : [];
  const used = new Set<number>();

  const findSourceRow = (meta: any) => {
    const expectedQn = Number(meta?.questionNumber);
    const expectedText = normText(meta?.question);
    const expectedLabel = normText(meta?.displayLabel);

    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      const qn = Number(rows[i]?.questionNumber);
      if (Number.isFinite(qn) && qn === expectedQn) return i;
    }
    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      if (normText(rows[i]?.questionText) === expectedText) return i;
    }
    if (expectedLabel) {
      for (let i = 0; i < rows.length; i++) {
        if (used.has(i)) continue;
        if (normText(rows[i]?.displayLabel) === expectedLabel) return i;
      }
    }
    for (let i = 0; i < rows.length; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  };

  const fixed = keyPointsData.map((meta) => {
    const idx = findSourceRow(meta);
    if (idx >= 0) used.add(idx);
    const item = idx >= 0 ? rows[idx] ?? {} : {};
    const maxQ = questionCeiling(meta);

    let score = Number(item.score ?? item.pointsEarned);
    if (Number.isNaN(score)) score = 0;

    const rubric: KeyPointRow[] = meta?.keyPoints || [];
    let ev = item.evaluatedKeyPoints;

    if (Array.isArray(ev) && ev.length > 0) {
      ev = ev.map((row: any) => {
        const match = rubric.find((r) => r.point === row.point);
        const cap =
          match != null ? Number(match.maxWeight ?? match.grade) : undefined;
        let earned = Number(row.earnedGrade) || 0;
        if (typeof cap === "number" && Number.isFinite(cap)) {
          earned = Math.min(cap, Math.max(0, earned));
        }
        return { ...row, earnedGrade: round2(earned) };
      });

      const sumEarned = ev.reduce(
        (s: number, r: any) => s + (Number(r.earnedGrade) || 0),
        0
      );
      score = Math.min(maxQ, Math.max(score, sumEarned));

      if (rubric.length > 0 && ev.length > 0 && ev.every((r: any) => r.matched)) {
        ev = ev.map((row: any) => {
          const match = rubric.find((r) => r.point === row.point);
          const cap = Number(match?.maxWeight ?? match?.grade ?? row.earnedGrade ?? 0);
          return { ...row, earnedGrade: round2(Math.max(0, cap)) };
        });
        score = maxQ;
      }
    }

    score = round2(Math.min(maxQ, Math.max(0, score)));

    return {
      ...item,
      questionNumber: Number(meta?.questionNumber) || Number(item.questionNumber) || 0,
      displayLabel: meta?.displayLabel || item.displayLabel,
      questionText: item.questionText || meta?.question || "",
      modelAnswer: item.modelAnswer || meta?.modelAnswer || "",
      score,
      pointsEarned: score,
      evaluatedKeyPoints: ev ?? item.evaluatedKeyPoints,
    };
  });

  let totalScore = round2(fixed.reduce((s, b) => s + (Number(b.score) || 0), 0));
  if (typeof examTotalGrade === "number" && examTotalGrade > 0) {
    totalScore = round2(Math.min(examTotalGrade, totalScore));
  }

  const sorted = [...fixed].sort(
    (a, b) =>
      Number(a.questionNumber ?? 0) - Number(b.questionNumber ?? 0)
  );

  return { breakdown: sorted, totalScore };
}

// â”€â”€â”€ JSON parsing (uses shared safe-json) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parsePossiblyWrappedJson(rawResponse: string): any {
  return parseJsonOrThrow(
    rawResponse,
    "ÙØ´Ù„ ÙÙŠ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ù†ØªØ§Ø¦Ø¬ Ø§Ù„ØªØµØ­ÙŠØ­ Ø¨ØªÙ†Ø³ÙŠÙ‚ JSON ØµØ­ÙŠØ­."
  );
}

// â”€â”€â”€ Semantic strict rescue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runSemanticStrictRescue(params: {
  modelName: string;
  breakdown: any[];
  keyPointsData: any[];
}) {
  const { modelName, breakdown, keyPointsData } = params;
  if (!SEMANTIC_STRICT) return breakdown;
  if (!Array.isArray(breakdown) || !breakdown.length) return breakdown;

  const out = [...breakdown];
  const candidates = out
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => {
      const qNum = Number(row?.questionNumber);
      const meta = keyPointsData.find((k) => Number(k?.questionNumber) === qNum);
      const maxQ = questionCeiling(meta);
      const score = Number(row?.score ?? row?.pointsEarned ?? 0);
      const studentAnswer = String(row?.studentAnswer ?? "").trim();
      const modelAnswer = String(row?.modelAnswer ?? meta?.modelAnswer ?? "").trim();
      if (!studentAnswer || studentAnswer.length < 8) return false;
      if (!(maxQ > 0)) return false;
      if (hasAnswerLanguageMismatch(studentAnswer, modelAnswer) && score < maxQ) {
        return true;
      }
      return score <= maxQ * 0.6;
    })
    .slice(0, 4);

  if (!candidates.length) return out;

  const provider = aiManager.getServiceProvider(SERVICE);

  for (const c of candidates) {
    try {
      const qNum = Number(c.row.questionNumber);
      const meta = keyPointsData.find((k) => Number(k?.questionNumber) === qNum);
      const maxQ = questionCeiling(meta);
      const prompt = buildSemanticRescuePrompt({
        questionText: c.row.questionText || meta?.question || "",
        modelAnswer: c.row.modelAnswer || meta?.modelAnswer || "",
        studentAnswer: c.row.studentAnswer || "",
        keyPoints: (meta?.keyPoints || []).map((k: any) => k.point),
      });
      const result = await provider.generateContent([{ text: prompt }], {
        model: modelName,
        temperature: 0,
        responseMimeType: "application/json",
      });
      const raw = result.text;
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      const ok = Boolean(parsed?.conceptuallyCorrect);
      const conf = Number(parsed?.confidence ?? 0);
      if (!ok || conf < 0.8) continue;

      const row = { ...out[c.i] };
      row.score = round2(maxQ);
      row.pointsEarned = round2(maxQ);
      if (Array.isArray(row.evaluatedKeyPoints) && row.evaluatedKeyPoints.length) {
        row.evaluatedKeyPoints = row.evaluatedKeyPoints.map((kp: any) => {
          const capMatch = (meta?.keyPoints || []).find(
            (m: any) => String(m.point) === String(kp.point)
          );
          const cap = Number(
            capMatch?.maxWeight ?? capMatch?.grade ?? kp.earnedGrade ?? 0
          );
          return { ...kp, matched: true, earnedGrade: round2(Math.max(0, cap)) };
        });
      }
      row.reasoningAr = `ØªØ­Ù‚Ù‚ Ø¯Ù„Ø§Ù„ÙŠ ØµØ§Ø±Ù…: Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© ØµØ­ÙŠØ­Ø© Ù…ÙØ§Ù‡ÙŠÙ…ÙŠØ§Ù‹ (${String(
        parsed?.reasonAr ?? "Ù…Ø·Ø§Ø¨Ù‚Ø© Ø§Ù„Ù…Ø¹Ù†Ù‰"
      )}).`;
      row.reasoning = row.reasoningAr;
      out[c.i] = row;
    } catch (e) {
      console.warn("[grading] semantic strict rescue skipped:", e);
    }
  }

  return out;
}

// â”€â”€â”€ Public runner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Grading pipeline; auth is enforced by the API gateway (BFF + internal secret). */
export async function runGrading(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      studentAnswers?: unknown;
      keyPointsData?: unknown;
      referenceMaterialsText?: unknown;
      examTotalGrade?: unknown;
    };
    const {
      studentAnswers,
      keyPointsData,
      referenceMaterialsText,
      examTotalGrade,
    } = body;

    if (!studentAnswers || !keyPointsData) {
      return Response.json(
        { error: "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØµØ­ÙŠØ­ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© Ù…ÙÙ‚ÙˆØ¯Ø©" },
        { status: 400 }
      );
    }

    const sortedAnswers = canonicalizeStudentAnswers(studentAnswers as unknown[]);
    const sortedKeyMeta = canonicalizeKeyPointsMeta(keyPointsData as unknown[]);
    const normalizedKeyPoints = normalizeBranchWeights(sortedKeyMeta);

    const examTotalNum =
      typeof examTotalGrade === "number" && Number.isFinite(examTotalGrade)
        ? examTotalGrade
        : undefined;
    const refText =
      typeof referenceMaterialsText === "string" ? referenceMaterialsText : "";

    const cachePayload = buildGradingCachePayload(
      sortedAnswers,
      normalizedKeyPoints,
      examTotalNum,
      refText
    );
    const cacheKey = gradingCacheKey(cachePayload);
    const cached = getCachedGradingJson(cacheKey);
    if (
      cached &&
      typeof cached === "object" &&
      cached !== null &&
      "breakdown" in (cached as object) &&
      "totalScore" in (cached as object)
    ) {
      return Response.json(deepRound2Values(cached));
    }

    const provider = aiManager.getServiceProvider(SERVICE);
    const MODELS = aiManager.getServiceModels(SERVICE);
    const maxTokens = 8192;

    const runGradingPipeline = async (): Promise<Record<string, unknown>> => {
      const prompt = buildGradingPrompt({
        sortedAnswers,
        normalizedKeyPoints,
        examTotalGrade: examTotalNum,
        referenceMaterialsText: refText,
      });

      let lastError: unknown = null;
      let rawResponse = "";

      outer: for (const modelName of MODELS) {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            const result = await provider.generateContent([{ text: prompt }], {
              model: modelName,
              temperature: 0,
              maxTokens,
              responseMimeType: "application/json",
            });
            rawResponse = result.text || "";
            if (rawResponse.trim()) break outer;
            lastError = new Error("Empty response");
          } catch (err: unknown) {
            lastError = err;
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.includes("429") ||
              msg.includes("503") ||
              msg.toLowerCase().includes("overloaded")
            ) {
              console.warn(
                `[grading] Model ${modelName} busy/limited. Trying next fallback...`
              );
              continue outer;
            }
            if (isTransientNetworkError(err) && attempt < 2) {
              await sleep(750);
              continue;
            }
            console.error(`[grading] Model ${modelName} (gemini) failed:`, msg);
            continue outer;
          }
        }
      }

      if (!rawResponse.trim()) {
        console.error("Grading Error (all models):", lastError);
        throw new GradingHttpError(500, {
          error: userFacingAIError(lastError ?? new Error("ÙØ´Ù„ Ø§Ù„ØªØµØ­ÙŠØ­")),
        });
      }

      const parsed = parsePossiblyWrappedJson(rawResponse);
      const rescuedBreakdown = await runSemanticStrictRescue({
        modelName: MODELS[0] || "default",
        breakdown: parsed.breakdown || [],
        keyPointsData: normalizedKeyPoints,
      });
      const { breakdown: recBreak, totalScore: recTotal } = reconcileScores(
        rescuedBreakdown,
        normalizedKeyPoints,
        examTotalNum
      );

      const responseBody = {
        success: true as const,
        totalScore: round2(Number(recTotal) || 0),
        breakdown: recBreak.map((item: any) => {
          const qn = Number(item.questionNumber);
          const originalInput = sortedAnswers.find((s) => s.questionNumber === qn);
          const originalModel = normalizedKeyPoints.find(
            (k: any) =>
              Number(k.questionNumber) === qn ||
              k.question === item.questionText
          );
          const qScore = round2(Number(item.score ?? item.pointsEarned) || 0);

          return {
            ...item,
            score: qScore,
            studentAnswer: item.studentAnswer || originalInput?.studentAnswer || "",
            modelAnswer: item.modelAnswer || originalModel?.modelAnswer || "",
            questionText:
              item.questionText ||
              originalInput?.questionText ||
              originalModel?.question ||
              "",
            displayLabel: originalModel?.displayLabel || item.displayLabel,
            pointsEarned: qScore,
            reasoning: item.reasoningAr,
          };
        }),
      };

      const finalized = deepRound2Values(responseBody) as Record<string, unknown>;
      setCachedGradingJson(cacheKey, finalized);
      return finalized;
    };

    let gradingPromise = inflightGrading.get(cacheKey) as
      | Promise<Record<string, unknown>>
      | undefined;
    if (!gradingPromise) {
      gradingPromise = runGradingPipeline();
      inflightGrading.set(cacheKey, gradingPromise);
      void gradingPromise.then(
        () => inflightGrading.delete(cacheKey),
        () => inflightGrading.delete(cacheKey)
      );
    }

    const out = await gradingPromise;
    return Response.json(out);
  } catch (error: unknown) {
    console.error("Grading Error:", error);

    if (error instanceof GradingHttpError) {
      return Response.json(error.payload, { status: error.statusCode });
    }
    if (
      (error as { status?: number })?.status === 429 ||
      (error instanceof Error && error.message?.includes("429"))
    ) {
      return Response.json(
        { error: "Ø§Ù„Ø®Ø¯Ù…Ø© Ù…Ø²Ø¯Ø­Ù…Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± 30 Ø«Ø§Ù†ÙŠØ© ÙˆØ§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰." },
        { status: 429 }
      );
    }
    return Response.json(
      { error: userFacingAIError(error) },
      { status: 500 }
    );
  }
}
