/** ضبط مجموع درجات محاور التقييم الفرعية حتى لا يتجاوز سقف درجة السؤال */

export function sumKeyPointGrades(
  keyPoints: { defaultGrade: number }[]
): number {
  return keyPoints.reduce((s, k) => s + (Number(k.defaultGrade) || 0), 0);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** تقريب كل الأرقام في شجرة JSON إلى منزلتين — ثبات العرض والتخزين المؤقت */
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

/** درجة السؤال الكاملة من محاور التقييم بعد التقريب الثنائي */
export function totalQuestionPointsFromKeyPoints(
  keyPoints: { defaultGrade: number }[]
): number {
  return round2(sumKeyPointGrades(keyPoints));
}

/**
 * إذا تجاوز مجموع المحاور maxPoints يُعاد توزيع الدرجات بنفس النسب تقريباً مع تعديل آخر بند لإغلاق الفرق الرقمي.
 */
export function normalizeKeyPointsToCap<
  T extends { defaultGrade: number; point?: string },
>(keyPoints: T[], maxPoints: number): T[] {
  if (!keyPoints.length || !Number.isFinite(maxPoints) || maxPoints <= 0) {
    return keyPoints;
  }
  const sum = sumKeyPointGrades(keyPoints);
  if (sum <= maxPoints + 1e-9) {
    return keyPoints.map((k) => ({ ...k, defaultGrade: round2(Number(k.defaultGrade) || 0) }));
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

/**
 * Split `total` equally across key points (last point absorbs rounding drift).
 * Used when the teacher sets a question score and key points should share it.
 */
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
