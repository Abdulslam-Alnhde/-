/**
 * ترتيب أسئلة الاختبار للعرض: حسب الترقيم الظاهر على الورقة (مثل 3.1 قبل 3.2 ثم 4.1).
 * UUID لا يعكس ترتيب الورقة.
 */

function numericPartsFromDisplayLabel(
  displayLabel: string | null | undefined
): number[] | null {
  const dl = (displayLabel ?? "").trim();
  if (!dl) return null;
  const simple = dl.match(/^(\d+)(?:\.(\d+))?$/);
  if (simple) {
    const g = parseInt(simple[1], 10);
    const s = simple[2] ? parseInt(simple[2], 10) : 0;
    return [g, s];
  }
  const segs = dl
    .split(/[.\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n));
  if (segs.length >= 2) return [segs[0], segs[1]];
  if (segs.length === 1) return [segs[0], 0];
  return null;
}

export function sortExamQuestionsForDisplay<
  T extends { displayLabel?: string | null; id: string },
>(questions: T[]): T[] {
  return [...questions].sort((a, b) => {
    const pa = numericPartsFromDisplayLabel(a.displayLabel);
    const pb = numericPartsFromDisplayLabel(b.displayLabel);
    if (pa && pb) {
      if (pa[0] !== pb[0]) return pa[0] - pb[0];
      if (pa[1] !== pb[1]) return pa[1] - pb[1];
      return a.id.localeCompare(b.id);
    }
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    return a.id.localeCompare(b.id);
  });
}
