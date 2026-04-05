/** عرض الدرجات بمنزلتين عشريتين دائماً (مثل 12.90 أو 3.75) */
export function formatScore2(n: number | null | undefined): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  const rounded = Math.round(x * 100) / 100;
  return rounded.toFixed(2);
}
