/**
 * ترقيم أسئلة الورقة: يُفضَّل الترقيم الهيكلي (groupNumber + subIndex) على
 * displayLabel القادم من النموذج اللغوي لأنه قد يخطئ (مثل 4.1 بدل 3.1).
 */
export type QuestionLabelInput = {
  displayLabel?: string | null;
  groupNumber?: number;
  subIndex?: number;
};

export function getQuestionDisplayLabel(
  q: QuestionLabelInput,
  zeroBasedIndex: number
): string {
  const dl = (q.displayLabel ?? "").trim();
  const g = q.groupNumber;
  const s = q.subIndex;

  const gOk = typeof g === "number" && Number.isFinite(g) && g >= 1;
  const sOk = typeof s === "number" && Number.isFinite(s) && s >= 1;

  if (gOk && sOk) {
    const looksSubNumbered = /^\d+\.\d+$/.test(dl) || s > 1;
    if (looksSubNumbered) {
      return `${g}.${s}`;
    }
    if (/^\d+$/.test(dl) && !dl.includes(".")) {
      return dl;
    }
    if (!dl) {
      return s === 1 ? String(g) : `${g}.${s}`;
    }
  }

  if (dl) return dl;
  return String(zeroBasedIndex + 1);
}
