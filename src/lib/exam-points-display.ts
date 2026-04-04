import { round2 } from "@/lib/exam-keypoints-normalize";

/** يمنع عرض أرقام بصيغة علمية (مثل 5e-324) ناتجة عن أخطاء تعويم */
function isGarbageFloat(n: number): boolean {
  return n > 0 && n < 1e-6;
}

/**
 * درجة السؤال المعروضة: إن كانت قيمة الحقل `points` مشوّهة نأخذ مجموع المحاور.
 */
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

/** عرض درجة السؤال مع الاعتماد على المحاور عند الحاجة */
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
