export function estimateNumberedQuestionCountFromText(text: string): number {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+\S+/.test(line)).length;
}

export function shouldAcceptFastPdfExtraction(params: {
  normalizedText: string;
  parsedQuestions: Array<{ modelAnswer?: string }>;
}) {
  const { normalizedText, parsedQuestions } = params;
  if (!Array.isArray(parsedQuestions) || parsedQuestions.length < 3) {
    return false;
  }

  const estimatedQuestionCount =
    estimateNumberedQuestionCountFromText(normalizedText);
  if (estimatedQuestionCount <= 0) {
    return false;
  }

  const answeredQuestions = parsedQuestions.filter(
    (item: { modelAnswer?: string }) => String(item?.modelAnswer || "").trim().length > 0
  ).length;
  const coverage = parsedQuestions.length / estimatedQuestionCount;
  const answerCoverage = answeredQuestions / parsedQuestions.length;

  return coverage >= 0.75 && answerCoverage >= 0.9;
}
