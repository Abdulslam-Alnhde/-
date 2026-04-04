/** لعرض نصوص الاختبار الإنجليزية بمحاذاة LTR داخل واجهة عربية */

export function isPrimarilyEnglish(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (t.length < 4) return false;
  let latin = 0;
  let arabic = 0;
  for (const ch of t) {
    if (/[a-zA-Z]/.test(ch)) latin++;
    else if (/[\u0600-\u06FF\u0750-\u077F]/.test(ch)) arabic++;
  }
  if (latin + arabic < 4) return false;
  return latin >= arabic;
}
