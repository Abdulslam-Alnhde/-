/**
 * حسابات وتطبيع مرتبطة بالدرجات والتصحيح.
 * ملف واحد بدون Node APIs — آمن للاستيراد من المكوّنات (use client) ومن مسارات API.
 */

// ─── درجات المحاور وسقف الأسئلة ─────────────────────────────────────────

export function sumKeyPointGrades(
  keyPoints: { defaultGrade: number }[]
): number {
  return keyPoints.reduce((s, k) => s + (Number(k.defaultGrade) || 0), 0);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function questionTotalPoints(question: {
  keyPoints?: { defaultGrade: number }[];
  questionMaxPoints?: number;
}): number {
  const keyPoints = Array.isArray(question.keyPoints) ? question.keyPoints : [];
  if (keyPoints.length > 0) {
    return round2(sumKeyPointGrades(keyPoints));
  }
  const direct = Number(question.questionMaxPoints);
  return Number.isFinite(direct) && direct > 0 ? round2(direct) : 0;
}

/** تقريب كل الأرقام في شجرة JSON إلى منزلتين — ثبات العرض ومفاتيح التخزين المؤقت */
export function deepRound2Values(value: unknown): unknown {
  if (typeof value === "number") {
    return Number.isFinite(value) ? round2(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map(deepRound2Values);
  }
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = deepRound2Values(o[k]);
    }
    return out;
  }
  return value;
}

export function totalQuestionPointsFromKeyPoints(
  keyPoints: { defaultGrade: number }[]
): number {
  return round2(sumKeyPointGrades(keyPoints));
}

export function normalizeKeyPointsToCap<
  T extends { defaultGrade: number; point?: string },
>(keyPoints: T[], maxPoints: number): T[] {
  if (!keyPoints.length || !Number.isFinite(maxPoints) || maxPoints <= 0) {
    return keyPoints;
  }
  const sum = sumKeyPointGrades(keyPoints);
  if (sum <= maxPoints + 1e-9) {
    return keyPoints.map((k) => ({
      ...k,
      defaultGrade: round2(Number(k.defaultGrade) || 0),
    }));
  }
  const factor = maxPoints / sum;
  const scaled = keyPoints.map((k) => ({
    ...k,
    defaultGrade: round2((Number(k.defaultGrade) || 0) * factor),
  }));
  const newSum = sumKeyPointGrades(scaled);
  const drift = round2(maxPoints - newSum);
  if (scaled.length && Math.abs(drift) > 1e-6) {
    const last = { ...scaled[scaled.length - 1] };
    last.defaultGrade = round2(last.defaultGrade + drift);
    if (last.defaultGrade < 0) last.defaultGrade = 0;
    scaled[scaled.length - 1] = last;
  }
  return scaled;
}

export function distributeEqualAmongKeyPoints<
  T extends { defaultGrade: number; point?: string },
>(keyPoints: T[], total: number): T[] {
  if (!keyPoints.length || !Number.isFinite(total) || total <= 0) {
    return keyPoints.map((k) => ({
      ...k,
      defaultGrade: round2(Number(k.defaultGrade) || 0),
    }));
  }
  const n = keyPoints.length;
  const base = round2(total / n);
  const out = keyPoints.map((k, i) => ({
    ...k,
    defaultGrade: i < n - 1 ? base : round2(total - base * (n - 1)),
  }));
  return out;
}

export function scaleAllQuestionsToTotal<
  Q extends {
    questionMaxPoints?: number;
    keyPoints: { defaultGrade: number; point?: string }[];
  },
>(questions: Q[], targetTotal: number): Q[] {
  if (!questions.length || targetTotal <= 0) return questions;

  const currentTotal = questions.reduce((acc, q) => {
    return acc + questionTotalPoints(q);
  }, 0);

  if (currentTotal <= targetTotal + 1e-6) return questions;

  const factor = targetTotal / currentTotal;

  return questions.map((q) => {
    const currentQSum = questionTotalPoints(q);
    const targetQSum = round2(currentQSum * factor);

    if (!q.keyPoints.length) {
      return {
        ...q,
        questionMaxPoints: targetQSum,
      };
    }

    return {
      ...q,
      questionMaxPoints: targetQSum,
      keyPoints: normalizeKeyPointsToCap(q.keyPoints, targetQSum),
    };
  });
}

// ─── تطبيع نصوص التصحيح والمدخلات الموحدة ────────────────────────────────

export function normalizeTextForGrading(s: string): string {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function canonicalizeStudentAnswers(raw: unknown[]): {
  questionNumber: number;
  studentAnswer: string;
  questionText: string;
}[] {
  return [...raw]
    .map((a) => {
      const row = a as Record<string, unknown>;
      return {
      questionNumber: Number(row?.questionNumber),
      studentAnswer: normalizeTextForGrading(
        String(row?.studentAnswer ?? "")
      ),
      questionText: normalizeTextForGrading(
        String(row?.questionText ?? "")
      ),
    };
    })
    .filter((a) => Number.isFinite(a.questionNumber))
    .sort((x, y) => x.questionNumber - y.questionNumber);
}

export function canonicalizeKeyPointsMeta(raw: unknown[]): any[] {
  return [...raw]
    .map((item) => {
      const meta = item as Record<string, unknown>;
      return {
      questionNumber: Number(meta?.questionNumber),
      question: normalizeTextForGrading(String(meta?.question ?? "")),
      questionType: String(meta?.questionType ?? "RUBRIC")
        .trim()
        .toUpperCase(),
      displayLabel:
        meta?.displayLabel != null
          ? normalizeTextForGrading(String(meta.displayLabel))
          : undefined,
      teacherNote: normalizeTextForGrading(String(meta?.teacherNote ?? "")),
      modelAnswer: normalizeTextForGrading(String(meta?.modelAnswer ?? "")),
      questionMaxPoints: round2(
        Number(meta?.questionMaxPoints ?? meta?.points) || 10
      ),
      keyPoints: (Array.isArray(meta?.keyPoints) ? meta.keyPoints : []).map(
        (k) => {
          const row = k as Record<string, unknown>;
          return {
          point: normalizeTextForGrading(String(row?.point ?? "")),
          maxWeight: round2(Number(row?.maxWeight ?? row?.grade) || 0),
          grade: round2(Number(row?.grade ?? row?.maxWeight) || 0),
        };
        }
      ),
    };
    })
    .filter((m) => Number.isFinite(m.questionNumber))
    .sort((a, b) => a.questionNumber - b.questionNumber);
}

export function buildGradingCachePayload(
  sortedAnswers: ReturnType<typeof canonicalizeStudentAnswers>,
  normalizedKeyPoints: unknown[],
  examTotalGrade: unknown,
  referenceMaterialsText: string
) {
  return {
    sortedAnswers,
    normalizedKeyPoints: deepRound2Values(normalizedKeyPoints),
    examTotalGrade:
      examTotalGrade != null && examTotalGrade !== ""
        ? round2(Number(examTotalGrade))
        : null,
    referenceMaterialsText: normalizeTextForGrading(
      String(referenceMaterialsText || "")
    ),
  };
}

// ─── تطابق لغة إجابة الطالب مع النموذج ───────────────────────────────────

export function containsArabicScript(text: unknown): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    String(text ?? "")
  );
}

export function containsLatinScript(text: unknown): boolean {
  return /[A-Za-z]/.test(String(text ?? ""));
}

export function hasAnswerLanguageMismatch(
  studentAnswer: unknown,
  modelAnswer: unknown
): boolean {
  const studentHasArabic = containsArabicScript(studentAnswer);
  const modelHasArabic = containsArabicScript(modelAnswer);
  const studentHasLatin = containsLatinScript(studentAnswer);
  const modelHasLatin = containsLatinScript(modelAnswer);

  return (
    (studentHasArabic && modelHasLatin && !modelHasArabic) ||
    (modelHasArabic && studentHasLatin && !studentHasArabic)
  );
}

// ─── عرض الدرجات (واجهة) ───────────────────────────────────────────────

function isGarbageFloat(n: number): boolean {
  return n > 0 && n < 1e-6;
}

/** درجة السؤال المعروضة: إن كانت قيمة `points` مشوّهة نأخذ مجموع المحاور. */
export function effectiveQuestionPoints(q: {
  points?: unknown;
  keyPoints?: { grade?: unknown }[];
}): number {
  const raw = Number(q.points);
  if (Number.isFinite(raw) && !isGarbageFloat(raw) && raw >= 0) {
    return round2(raw);
  }
  const sum = (q.keyPoints ?? []).reduce(
    (s, k) => s + (Number(k.grade) || 0),
    0
  );
  return round2(sum);
}

export function formatPointsArLabel(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (isGarbageFloat(n)) return "—";
  if (Math.abs(n) < 1e-12) return "0 درجة";
  const r = round2(n);
  const t = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(r);
  return `${t} درجة`;
}

export function formatQuestionPointsAr(q: {
  points?: unknown;
  keyPoints?: { grade?: unknown }[];
}): string {
  return formatPointsArLabel(effectiveQuestionPoints(q));
}

export function formatKeyPointGradeAr(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (isGarbageFloat(n)) return "—";
  if (Math.abs(n) < 1e-12) return "0";
  const r = round2(n);
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(r);
}

export function formatExamTotalGradeAr(value: unknown): string {
  return formatPointsArLabel(value);
}
