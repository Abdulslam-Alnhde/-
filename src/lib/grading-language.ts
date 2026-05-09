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
