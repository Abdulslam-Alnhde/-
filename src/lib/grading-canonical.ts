import { round2, deepRound2Values } from "@/lib/exam-keypoints-normalize";

/** توحيد النص قبل التجزئة والتصحيح — يقلّل اختلاف المفتاح بسبب مسافات/أسطر أو يونيكود */
export function normalizeTextForGrading(s: string): string {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** إجابات الطالب بترتيب ثابت ونصوص مُنظَّفة — نفس المدخلات = نفس مفتاح التخزين المؤقت */
export function canonicalizeStudentAnswers(raw: unknown[]): {
  questionNumber: number;
  studentAnswer: string;
  questionText: string;
}[] {
  return [...raw]
    .map((a: any) => ({
      questionNumber: Number(a?.questionNumber),
      studentAnswer: normalizeTextForGrading(
        String(a?.studentAnswer ?? "")
      ),
      questionText: normalizeTextForGrading(
        String(a?.questionText ?? "")
      ),
    }))
    .filter((a) => Number.isFinite(a.questionNumber))
    .sort((x, y) => x.questionNumber - y.questionNumber);
}

/** معايير الأسئلة قبل normalizeBranchWeights — أرقام بمنزلتين وحقول نصية منظمة */
export function canonicalizeKeyPointsMeta(raw: unknown[]): any[] {
  return [...raw]
    .map((meta: any) => ({
      questionNumber: Number(meta?.questionNumber),
      question: normalizeTextForGrading(String(meta?.question ?? "")),
      displayLabel:
        meta?.displayLabel != null
          ? normalizeTextForGrading(String(meta.displayLabel))
          : undefined,
      teacherNote: normalizeTextForGrading(String(meta?.teacherNote ?? "")),
      modelAnswer: normalizeTextForGrading(String(meta?.modelAnswer ?? "")),
      questionMaxPoints: round2(
        Number(meta?.questionMaxPoints ?? meta?.points) || 10
      ),
      keyPoints: (meta?.keyPoints || []).map((k: any) => ({
        point: normalizeTextForGrading(String(k?.point ?? "")),
        maxWeight: round2(Number(k?.maxWeight ?? k?.grade) || 0),
        grade: round2(Number(k?.grade ?? k?.maxWeight) || 0),
      })),
    }))
    .filter((m) => Number.isFinite(m.questionNumber))
    .sort((a, b) => a.questionNumber - b.questionNumber);
}

/** حمولة مفتاح التخزين المؤقت: قيم رقمية مقربة لتفادي اختلاف التجزئة بسبب الفاصلة العائمة */
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
