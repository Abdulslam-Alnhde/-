/**
 * منطق "الاستخراج المُقيَّد" (Constrained Extraction):
 * المعلم يُعلن هيكل الاختبار (الأسئلة وأنواعها وتفرعاتها) قبل الرفع،
 * ثم نتحقق من أن نتيجة استخراج الذكاء الاصطناعي تطابق ذلك الهيكل —
 * لمنع الهلوسة في الاختبارات الكبيرة.
 */
import type {
  ExamStructure,
  ExtractedQuestion,
} from "@/modules/exams/store/useExamStore";

/** عدد الأسئلة الرئيسية المُعلَنة */
export const totalDeclaredQuestions = (s: ExamStructure): number =>
  s.questions.length;

/** عدد الأسئلة الموضوعية المُعلَنة */
export const declaredObjectiveCount = (s: ExamStructure): number =>
  s.questions.filter((q) => q.type === "OBJECTIVE").length;

/** عدد الأسئلة المقالية المُعلَنة */
export const declaredRubricCount = (s: ExamStructure): number =>
  s.questions.filter((q) => q.type === "RUBRIC").length;

/** إجمالي التفرعات المُعلَنة عبر كل الأسئلة */
export const declaredSubPartCount = (s: ExamStructure): number =>
  s.questions.reduce((sum, q) => sum + (Number(q.subPartCount) || 0), 0);

/** مجموع درجات الأسئلة المُعلَنة = الدرجة الكلية للاختبار */
export const declaredTotalGrade = (s: ExamStructure): number =>
  s.questions.reduce((sum, q) => sum + (Number(q.grade) || 0), 0);

/** ملخص الهيكل المُستخرَج فعلياً من نتيجة الـ AI */
export type ExtractedStructureSummary = {
  mainQuestions: number;
  objective: number;
  rubric: number;
  subParts: number;
};

/**
 * يلخّص قائمة الأسئلة المُستخرَجة (المسطّحة) إلى هيكل:
 * - الأسئلة تُجمَّع حسب groupNumber → كل مجموعة = سؤال رئيسي واحد.
 * - مجموعة فيها أكثر من فقرة → عدد فقراتها يُحسب ضمن "التفرعات".
 * - نوع السؤال الرئيسي = نوع غالبية فقراته.
 */
export function summarizeExtractedQuestions(
  questions: ExtractedQuestion[]
): ExtractedStructureSummary {
  const groups = new Map<string, ExtractedQuestion[]>();

  questions.forEach((q, i) => {
    const groupNum = Number(q.groupNumber);
    const key =
      Number.isFinite(groupNum) && groupNum >= 1 ? `g${groupNum}` : `i${i}`;
    const arr = groups.get(key) ?? [];
    arr.push(q);
    groups.set(key, arr);
  });

  let objective = 0;
  let rubric = 0;
  let subParts = 0;

  for (const leaves of Array.from(groups.values())) {
    const objectiveLeaves = leaves.filter(
      (l) => l.questionType === "OBJECTIVE"
    ).length;
    // التعادل أو الغالبية الموضوعية → السؤال موضوعي
    if (objectiveLeaves * 2 >= leaves.length) objective += 1;
    else rubric += 1;

    if (leaves.length > 1) subParts += leaves.length;
  }

  return {
    mainQuestions: groups.size,
    objective,
    rubric,
    subParts,
  };
}

export type StructureMismatch = {
  label: string;
  declared: number;
  found: number;
};

export type StructureValidation = {
  ok: boolean;
  /** true عندما لم يُعلن المعلم أي هيكل (مثلاً عند تعديل اختبار قديم) */
  skipped: boolean;
  summary: ExtractedStructureSummary;
  mismatches: StructureMismatch[];
};

/**
 * يتحقق من تطابق الهيكل المُعلَن مع نتيجة الاستخراج.
 * يُرجِع قائمة بالفروقات إن وُجدت.
 */
export function validateExamStructure(
  structure: ExamStructure,
  questions: ExtractedQuestion[]
): StructureValidation {
  const summary = summarizeExtractedQuestions(questions);

  if (totalDeclaredQuestions(structure) === 0) {
    return { ok: true, skipped: true, summary, mismatches: [] };
  }

  const objective = declaredObjectiveCount(structure);
  const rubric = declaredRubricCount(structure);
  const subParts = declaredSubPartCount(structure);

  const mismatches: StructureMismatch[] = [];

  if (summary.objective !== objective) {
    mismatches.push({
      label: "الأسئلة الموضوعية",
      declared: objective,
      found: summary.objective,
    });
  }
  if (summary.rubric !== rubric) {
    mismatches.push({
      label: "الأسئلة المقالية",
      declared: rubric,
      found: summary.rubric,
    });
  }
  if (summary.subParts !== subParts) {
    mismatches.push({
      label: "إجمالي التفرعات",
      declared: subParts,
      found: summary.subParts,
    });
  }

  return {
    ok: mismatches.length === 0,
    skipped: false,
    summary,
    mismatches,
  };
}
