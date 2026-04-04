import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { gradingModelsChain } from "@/lib/gemini-config";
import {
  isTransientNetworkError,
  sleep,
  userFacingGeminiError,
} from "@/lib/gemini-helpers";
import { requireAuth } from "@/lib/auth-server";
import { deepRound2Values, round2 } from "@/lib/exam-keypoints-normalize";
import {
  buildGradingCachePayload,
  canonicalizeKeyPointsMeta,
  canonicalizeStudentAnswers,
} from "@/lib/grading-canonical";
import {
  getCachedGradingJson,
  gradingCacheKey,
  setCachedGradingJson,
} from "@/lib/grading-result-cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const SEMANTIC_STRICT = process.env.GRADING_SEMANTIC_STRICT !== "false";

/** طلبات تصحيح متزامنة لنفس المدخلات — نتيجة واحدة فقط (يقلّل تباين Gemini) */
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

export const dynamic = "force-dynamic";

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

/**
 * Uses teacher-defined rubric weights when present; scales them to questionMaxPoints.
 * Falls back to equal split only when weights are all zero.
 */
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
            point: "الإجابة الكاملة للسؤال (لا توجد فروع في النموذج)",
            maxWeight: qMax,
            grade: qMax,
          },
        ],
      };
    }
    const weights = raw.map((k: any) =>
      Number(k.maxWeight ?? k.grade ?? k.defaultGrade) || 0
    );
    const sumW = weights.reduce((a, b) => a + b, 0);
    let caps: number[];
    if (sumW > 0) {
      const factor = qMax / sumW;
      caps = weights.map((w) => round2(w * factor));
      const newSum = caps.reduce((a, b) => a + b, 0);
      const drift = round2(qMax - newSum);
      if (caps.length && Math.abs(drift) > 1e-6) {
        caps[caps.length - 1] = round2(caps[caps.length - 1] + drift);
        if (caps[caps.length - 1] < 0) caps[caps.length - 1] = 0;
      }
    } else {
      const n = raw.length;
      const per = round2(qMax / n);
      caps = raw.map((_, i) =>
        i < n - 1 ? per : round2(qMax - per * (n - 1))
      );
    }
    const n = raw.length;
    const perBranch =
      n > 0 ? round2(qMax / n) : qMax;
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
  if (sum > 0) return sum;
  return 10;
}

/** يوحّد درجات النموذج مع سلم النقاط الفرعية ويمنع التقييم المنخفض بلا مبرر عندما يحقق الطالب المعنى. */
function reconcileScores(
  breakdown: any[],
  keyPointsData: any[],
  examTotalGrade?: number
) {
  // نثبّت ترتيب/ترقيم النتائج على أسئلة الاختبار الحقيقية (من keyPointsData)
  // ونمنع اعتماد ترقيم هلوسي من النموذج مثل 4.4 بدل 5.
  const rows = Array.isArray(breakdown) ? breakdown : [];
  const used = new Set<number>();

  const findSourceRow = (meta: any) => {
    const expectedQn = Number(meta?.questionNumber);
    const expectedText = normText(meta?.question);
    const expectedLabel = normText(meta?.displayLabel);

    // 1) مطابق برقم السؤال (الأكثر موثوقية)
    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      const qn = Number(rows[i]?.questionNumber);
      if (Number.isFinite(qn) && qn === expectedQn) return i;
    }

    // 2) مطابق بنص السؤال بعد التطبيع
    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      if (normText(rows[i]?.questionText) === expectedText) return i;
    }

    // 3) مطابق بالـ displayLabel إن وُجد
    if (expectedLabel) {
      for (let i = 0; i < rows.length; i++) {
        if (used.has(i)) continue;
        if (normText(rows[i]?.displayLabel) === expectedLabel) return i;
      }
    }

    // 4) احتياطي: أول صف غير مستخدم
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
          match != null
            ? Number(match.maxWeight ?? match.grade)
            : undefined;
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

      // اتساق إلزامي: إذا كل الفروع محققة، لا يجوز إنقاص الدرجة.
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

  let totalScore = round2(
    fixed.reduce((s, b) => s + (Number(b.score) || 0), 0)
  );
  if (typeof examTotalGrade === "number" && examTotalGrade > 0) {
    totalScore = round2(Math.min(examTotalGrade, totalScore));
  }

  const sorted = [...fixed].sort(
    (a, b) =>
      Number(a.questionNumber ?? 0) - Number(b.questionNumber ?? 0)
  );

  return { breakdown: sorted, totalScore };
}

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
      const meta = keyPointsData.find(
        (k) => Number(k?.questionNumber) === qNum
      );
      const maxQ = questionCeiling(meta);
      const score = Number(row?.score ?? row?.pointsEarned ?? 0);
      const studentAnswer = String(row?.studentAnswer ?? "").trim();
      if (!studentAnswer || studentAnswer.length < 8) return false;
      if (!(maxQ > 0)) return false;
      // نفحص فقط الحالات "المشبوهة": درجة منخفضة رغم وجود إجابة نصية
      return score <= maxQ * 0.6;
    })
    .slice(0, 4); // حد أعلى لتكلفة/زمن الطلب

  if (!candidates.length) return out;

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
      topP: 1,
      topK: 1,
      candidateCount: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
    } as never,
  });

  for (const c of candidates) {
    try {
      const qNum = Number(c.row.questionNumber);
      const meta = keyPointsData.find(
        (k) => Number(k?.questionNumber) === qNum
      );
      const maxQ = questionCeiling(meta);
      const prompt = `
تحقق دلالي صارم لسؤال واحد (بدون تطابق حرفي).
احكم فقط: هل إجابة الطالب صحيحة مفاهيمياً مقارنة بالنموذج؟

قواعد إلزامية:
- تقبل اختلاف الأسلوب والصياغة والمرادفات.
- لا تعتبر الاختلاف اللغوي سبباً للخصم إذا المعنى العلمي صحيح.
- لا تُصَحِّح بالإملاء؛ صحّح بالمفهوم.
- إذا كان المعنى يحقق كل المطلوب، أجب true.

المدخلات:
- questionText: ${JSON.stringify(c.row.questionText || meta?.question || "")}
- modelAnswer: ${JSON.stringify(c.row.modelAnswer || meta?.modelAnswer || "")}
- studentAnswer: ${JSON.stringify(c.row.studentAnswer || "")}
- keyPoints: ${JSON.stringify((meta?.keyPoints || []).map((k: any) => k.point))}

أعد JSON فقط:
{
  "conceptuallyCorrect": boolean,
  "confidence": number,
  "reasonAr": string
}
`;
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
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
          const cap = Number(capMatch?.maxWeight ?? capMatch?.grade ?? kp.earnedGrade ?? 0);
          return {
            ...kp,
            matched: true,
            earnedGrade: round2(Math.max(0, cap)),
          };
        });
      }
      row.reasoningAr = `تحقق دلالي صارم: الإجابة صحيحة مفاهيمياً (${String(
        parsed?.reasonAr ?? "مطابقة المعنى"
      )}).`;
      row.reasoning = row.reasoningAr;
      out[c.i] = row;
    } catch (e) {
      // لا نفشل الطلب الرئيسي بسبب فشل تحقق ثانوي
      console.warn("[grade] semantic strict rescue skipped:", e);
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const body = await req.json();
    const {
      studentAnswers,
      keyPointsData,
      referenceMaterialsText,
      examTotalGrade,
    } = body;

    if (!studentAnswers || !keyPointsData) {
      return NextResponse.json(
        { error: "بيانات التصحيح المطلوبة مفقودة" },
        { status: 400 }
      );
    }

    const sortedAnswers = canonicalizeStudentAnswers(
      studentAnswers as unknown[]
    );
    const sortedKeyMeta = canonicalizeKeyPointsMeta(keyPointsData as unknown[]);

    const normalizedKeyPoints = normalizeBranchWeights(sortedKeyMeta);

    const cachePayload = buildGradingCachePayload(
      sortedAnswers,
      normalizedKeyPoints,
      examTotalGrade,
      referenceMaterialsText
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
      return NextResponse.json(deepRound2Values(cached));
    }

    /**
     * Gemini يتطلب seed من نوع int32.
     * نحول تجزئة SHA (uint32) إلى مجال آمن موجب [1 .. 2147483646].
     */
    const seedUnsigned = parseInt(cacheKey.slice(0, 8), 16) >>> 0;
    const safeSeedInt32 = (seedUnsigned % 2147483647) || 1;

    const runGradingPipeline = async (): Promise<Record<string, unknown>> => {
    const prompt = `
أنت مقيّم أكاديمي عادل ومتسامح مع صياغات الطالب المختلفة. مهمتك منح درجات عادلة تعكس الفهم العلمي وليس التطابق الحرفي.

## مبادئ إلزامية
1. **الأولوية للمعنى**: إذا نقل الطالب الفكرة الصحيحة بصياغة مختلفة أو ترتيب مختلف عن النموذج، فهذا يُعد إجابة صحيحة وتستحق الدرجة الكاملة أو شبه الكاملة حسب سلم النقاط.
2. **أخطاء الاستخراج/OCR**: النص قد يأتي من استخراج آلي؛ تجاهل لخبطة علامات الترقيم أو حروف زائدة ما لم تغيّر المعنى. لا تعاقب الطالب على ضوضاء الاستخراج.
3. **اللغة العربية**: الأخطاء الإملائية الطفيفة أو اختلاف المصطلحات المرادفة لا تُنقص الدرجة إذا كان المعنى العلمي سليماً.
4. **تقسيم الدرجة على الفروع (إلزامي)**: لكل سؤال، لكل بند في keyPoints تم ضبط **maxWeight** (أو grade) ليُمثّل سقف ذلك الفرع بعد التحجيم إلى **questionMaxPoints**. لا تتجاوز earnedGrade لأي فرع قيمة **maxWeight** له. مجموع earnedGrade لجميع الفروع للسؤال لا يتجاوز questionMaxPoints. (قد يكون التوزيع غير متساوٍ إذا حدد المعلم أوزاناً مختلفة.)
5. **منح النقاط الفرعية**: قيّم كل فرعاً مستقلاً مقابل ما يتوقعه النموذج في ذلك الفرع. إذا وُجد المعنى في إجابة الطالب (صريحاً أو ضمناً) لذلك الفرع، امنح حتى كامل pointsPerBranch. الفروع المتعددة = أجزاء متوقعة مختلفة من الإجابة وليست تكراراً.
6. **عدم إنقاص تعسفي**: إذا كان حقل إجابة الطالب يحتوي نصاً ذا معنى مطابق للنموذج، لا تُبرر درجة منخفضة بعبارات مثل "غير كافٍ" دون ذكر ما الذي ينقص فعلاً.
7. **تعليمات المعلم (teacherNote)**: لكل سؤال قد يُرسل حقل \`teacherNote\` و\`displayLabel\`. إذا وُجدت تعليمات في teacherNote، التزم بها في التصحيح وتفسير الإجابة قبل تطبيق سلم النقاط.
8. **صارم ضد الحرفية**: لا تعتمد على التطابق النصي/الحرفي. إذا كانت إجابة الطالب صحيحة بالمفهوم حتى مع كلمات مختلفة، اعتبرها صحيحة.
9. **اتساق القرار**: إذا ذكرت أن الطالب استوفى كل النقاط فلا يجوز إعطاء درجة ناقصة.

## قواعد JSON
- أعد نفس "studentAnswer" و"questionText" الواردة في المدخلات لكل سؤال (للمطابقة مع الواجهة).
- **جميع الأرقام (score، earnedGrade، totalScore) يجب أن تكون بمنزلتين عشريتين بالضبط** مثل 12.90 أو 3.00 أو 0.75 — لا تستخدم أكثر من منزلتين.
- "score" لكل سؤال: بين 0 و questionMaxPoints لهذا السؤال.
- "evaluatedKeyPoints": لكل بند من سلم النقاط الفرعية، حدد earnedGrade (لا يتجاوز maxWeight) و matched=true إذا تحقق المعنى.
- "totalScore": مجموع score لجميع الأسئلة، ويجب ألا يتجاوز examTotalGrade إن وُجد.
- **الاتساق**: عند تكرار نفس المدخلات يجب أن تكون الدرجات متطابقة — لا تغيّر المعايير بين المحاولات.

## بيانات السياق
- examTotalGrade (سقف الاختبار الكلي): ${examTotalGrade ?? "غير محدد"}
- الملازم والملاحظات: ${referenceMaterialsText || "لا يوجد."}

## بيانات التصحيح (JSON) — الأوزان مقسّمة بالتساوي على الفروع
إجابات الطالب: ${JSON.stringify(sortedAnswers)}
معايير الأسئلة (تشمل maxWeight لكل فرع): ${JSON.stringify(normalizedKeyPoints)}

## المخرجات
أعد JSON فقط بهذا الشكل:
{
  "totalScore": number,
  "breakdown": [
    {
      "questionNumber": number,
      "questionText": string,
      "studentAnswer": string,
      "modelAnswer": string,
      "score": number,
      "reasoningAr": string,
      "missingPoints": string[],
      "evaluatedKeyPoints": [
        { "point": string, "earnedGrade": number, "matched": boolean }
      ]
    }
  ]
}
`;

    const MODELS = gradingModelsChain();
    const maxAttemptsPerModel = 3;
    let rawResponse = "";
    let lastError: unknown = null;
    let graded = false;

    const genConfig = {
      responseMimeType: "application/json" as const,
      temperature: 0,
      topP: 1,
      topK: 1,
      candidateCount: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      /** مرتبط بمدخلات الطلب — نفس المدخلات ≈ نفس البذرة (قد لا يدعمها كل نموذج) */
      seed: safeSeedInt32,
    };

    outer: for (const modelName of MODELS) {
      for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: genConfig as never,
          });
          const result = await model.generateContent(prompt);
          rawResponse = result.response.text();
          graded = true;
          break outer;
        } catch (err: unknown) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("429") ||
            (err as { status?: number })?.status === 429
          ) {
            throw new GradingHttpError(429, {
              error:
                "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى.",
            });
          }
          if (attempt < maxAttemptsPerModel && isTransientNetworkError(err)) {
            await sleep(500 * attempt);
            continue;
          }
          try {
            const modelPlain = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: genConfig as never,
            });
            const result = await modelPlain.generateContent(prompt);
            rawResponse = result.response.text();
            graded = true;
            break outer;
          } catch (e2: unknown) {
            lastError = e2;
            break;
          }
        }
      }
    }

    if (!graded || !rawResponse) {
      console.error("Gemini Grading Error (all models):", lastError);
      throw new GradingHttpError(500, {
        error: userFacingGeminiError(lastError ?? new Error("فشل التصحيح")),
      });
    }

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("فشل في استخراج نتائج التصحيح بتنسيق JSON صحيح.");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rescuedBreakdown = await runSemanticStrictRescue({
      modelName: MODELS[0],
      breakdown: parsed.breakdown || [],
      keyPointsData: normalizedKeyPoints,
    });
    const { breakdown: recBreak, totalScore: recTotal } = reconcileScores(
      rescuedBreakdown,
      normalizedKeyPoints,
      examTotalGrade
    );

    const responseBody = {
      success: true as const,
      totalScore: round2(Number(recTotal) || 0),
      breakdown: recBreak.map((item: any) => {
        const qn = Number(item.questionNumber);
        const originalInput = sortedAnswers.find(
          (s) => s.questionNumber === qn
        );
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
          modelAnswer:
            item.modelAnswer || originalModel?.modelAnswer || "",
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

    const finalized = deepRound2Values(responseBody) as Record<
      string,
      unknown
    >;
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
    return NextResponse.json(out);
  } catch (error: unknown) {
    console.error("Gemini Grading Error:", error);

    if (error instanceof GradingHttpError) {
      return NextResponse.json(error.payload, { status: error.statusCode });
    }

    if (
      (error as { status?: number })?.status === 429 ||
      (error instanceof Error && error.message?.includes("429"))
    ) {
      return NextResponse.json(
        {
          error:
            "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: userFacingGeminiError(error) },
      { status: 500 }
    );
  }
}
