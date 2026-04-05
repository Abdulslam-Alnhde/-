/** مختصرات للعرض في الشريط والقائمة */
export function displayInitials(name: string): string {
  const cleaned = name.replace(/^د\.|م\.|أ\.\s*/g, "").trim();
  const w = cleaned.split(/\s+/).filter(Boolean);
  if (w.length === 0) return "؟";
  if (w.length === 1) return w[0].slice(0, 2);
  return (w[0][0] + w[1][0]).slice(0, 4);
}
