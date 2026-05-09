/** Exams domain — Prisma operations, scoring helpers, and committee notifications. */
import { prisma } from "@/lib/prisma";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import {
  questionTotalPoints,
  round2,
  totalQuestionPointsFromKeyPoints,
} from "@/lib/exam-scoring";
import { sortExamQuestionsForDisplay } from "@/lib/exam-question-order";
import { hasPermission, PERMISSION_KEYS } from "@/lib/permissions";
import type { Exam, Prisma, User } from "@prisma/client";

type QuestionCreateInput = Prisma.QuestionCreateWithoutExamInput;

export function buildQuestionCreatesFromExtracted(
  extractedQuestions: unknown[]
): QuestionCreateInput[] {
  return extractedQuestions.map((q: any, qi: number) => {
    const kps = Array.isArray(q.keyPoints) ? q.keyPoints : [];
    const points =
      kps.length > 0
        ? totalQuestionPointsFromKeyPoints(
            kps.map((kp: any) => ({ defaultGrade: Number(kp.defaultGrade) || 0 }))
          )
        : questionTotalPoints({
            keyPoints: [],
            questionMaxPoints: Number(q.questionMaxPoints) || 0,
          });
    return {
      content: q.question,
      modelAnswer: q.modelAnswer,
      type:
        q.questionType === "OBJECTIVE"
          ? ("OBJECTIVE" as const)
          : ("AI_EXTRACTED" as const),
      points,
      displayLabel: getQuestionDisplayLabel(q, qi),
      teacherNote: q.teacherNote?.trim() || null,
      keyPoints: {
        create: kps.map((kp: any) => ({
          point: String(kp.point ?? ""),
          grade: round2(Number(kp.defaultGrade) || 0),
        })),
      },
    };
  });
}

export function totalGradeFromCreates(
  questionCreates: Array<{ points?: number | null }>
): number {
  return round2(
    questionCreates.reduce((s, row) => s + (typeof row.points === "number" ? row.points : 0), 0)
  );
}

export function validateDeclaredMaxGrade(
  totalGrade: number,
  declaredMaxGrade: unknown
): string | null {
  if (
    typeof declaredMaxGrade === "number" &&
    Number.isFinite(declaredMaxGrade) &&
    declaredMaxGrade > 0 &&
    totalGrade > declaredMaxGrade + 1e-6
  ) {
    return `مجموع درجات الأسئلة (${totalGrade}) يتجاوز الدرجة الكلية المعتمدة (${declaredMaxGrade}).`;
  }
  return null;
}

export async function listTeacherExamsSorted(teacherId: string) {
  const exams = await prisma.exam.findMany({
    where: { teacherId },
    include: {
      questions: {
        include: { keyPoints: { orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return exams.map((e) => ({
    ...e,
    questions: sortExamQuestionsForDisplay(e.questions),
  }));
}

export async function listPendingExams() {
  return prisma.exam.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: { teacher: true, questions: { include: { keyPoints: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTeacherExamSorted(id: string, teacherId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId },
    include: {
      questions: {
        include: { keyPoints: { orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!exam) return null;
  return {
    ...exam,
    questions: sortExamQuestionsForDisplay(exam.questions),
  };
}

async function notifyCommittee(messageFactory: (user: { id: string }) => { title: string; message: string }) {
  const committeeUsers = await prisma.user.findMany({ where: { role: "COMMITTEE" } });
  if (committeeUsers.length === 0) return;
  await prisma.notification.createMany({
    data: committeeUsers.map((user) => {
      const m = messageFactory(user);
      return { userId: user.id, title: m.title, message: m.message, type: "status_change" };
    }),
  });
}

export async function resubmitRejectedExam(params: {
  examId: string;
  teacherId: string;
  title: unknown;
  date: unknown;
  type: unknown;
  extractedQuestions: unknown;
  declaredMaxGrade: unknown;
}): Promise<
  | { ok: true; exam: Awaited<ReturnType<typeof prisma.exam.update>> }
  | { ok: false; error: string; status: number }
> {
  const { examId, teacherId, title, date, type, extractedQuestions, declaredMaxGrade } =
    params;

  const existing = await prisma.exam.findFirst({ where: { id: examId, teacherId } });
  if (!existing) return { ok: false, error: "الاختبار غير موجود", status: 404 };
  if (existing.status !== "REJECTED") {
    return { ok: false, error: "يمكن إعادة الإرسال فقط للاختبارات المرفوضة", status: 400 };
  }
  if (!title || !Array.isArray(extractedQuestions)) {
    return { ok: false, error: "الحقول المطلوبة مفقودة", status: 400 };
  }

  const questionCreates = buildQuestionCreatesFromExtracted(extractedQuestions);
  const totalGrade = totalGradeFromCreates(questionCreates);
  const capErr = validateDeclaredMaxGrade(totalGrade, declaredMaxGrade);
  if (capErr) return { ok: false, error: capErr, status: 400 };

  const exam = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { examId } });
    return tx.exam.update({
      where: { id: examId },
      data: {
        title: String(title),
        description: `Exam Date: ${date ?? ""}`,
        type: type == null ? null : String(type),
        totalGrade,
        status: "PENDING_APPROVAL",
        committeeFeedback: null,
        questions: { create: questionCreates },
      },
      include: { questions: { include: { keyPoints: true } } },
    });
  });

  await notifyCommittee(() => ({
    title: "إعادة تقديم اختبار بعد التعديل",
    message: `أعاد المعلم تقديم الاختبار "${exam.title}" بعد الرفض — يرجى المراجعة.`,
  }));

  return { ok: true, exam };
}

export async function finalizeNewExam(params: {
  teacherId: string;
  title: unknown;
  date: unknown;
  type: unknown;
  extractedQuestions: unknown;
  declaredMaxGrade: unknown;
}): Promise<
  | { ok: true; exam: Awaited<ReturnType<typeof prisma.exam.create>> }
  | { ok: false; error: string; status: number }
> {
  const { teacherId, title, date, type, extractedQuestions, declaredMaxGrade } = params;
  if (!title || !Array.isArray(extractedQuestions)) {
    return { ok: false, error: "الحقول المطلوبة مفقودة", status: 400 };
  }
  const questionCreates = buildQuestionCreatesFromExtracted(extractedQuestions);
  const totalGrade = totalGradeFromCreates(questionCreates);
  const capErr = validateDeclaredMaxGrade(totalGrade, declaredMaxGrade);
  if (capErr) return { ok: false, error: capErr, status: 400 };

  const exam = await prisma.exam.create({
    data: {
      title: String(title),
      description: `Exam Date: ${date ?? ""}`,
      type: type == null ? null : String(type),
      totalGrade,
      status: "PENDING_APPROVAL",
      teacher: { connect: { id: teacherId } },
      questions: { create: questionCreates },
    },
    include: { questions: { include: { keyPoints: true } } },
  });

  await notifyCommittee(() => ({
    title: "طلب اعتماد اختبار جديد",
    message: `تم تقديم اختبار جديد بعنوان "${exam.title}" وهو بانتظار مراجعتك واعتمادك.`,
  }));

  return { ok: true, exam };
}

export function canCommitteeApprove(
  reviewer: Pick<User, "role"> & { permissionKeys?: string[] | null }
): boolean {
  return hasPermission(
    reviewer.role,
    reviewer.permissionKeys ?? [],
    PERMISSION_KEYS.APPROVE_EXAMS
  );
}

export async function committeeSetExamStatus(params: {
  examId: string | undefined;
  status: "APPROVED" | "REJECTED" | undefined;
  feedback: string;
}): Promise<
  | { ok: true; exam: Exam & { teacher: User } }
  | { ok: false; error: string; status: number }
> {
  const { examId, status, feedback } = params;
  if (!examId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
    return { ok: false, error: "بيانات غير صالحة", status: 400 };
  }
  if (status === "REJECTED" && !feedback) {
    return { ok: false, error: "سبب الرفض مطلوب (ملاحظة للمعلم)", status: 400 };
  }

  const exam = await prisma.exam.update({
    where: { id: examId },
    data: {
      status,
      committeeFeedback: status === "REJECTED" ? feedback : null,
    } as Parameters<typeof prisma.exam.update>[0]["data"],
    include: { teacher: true },
  });

  const noteLine = status === "REJECTED" && feedback ? ` الملاحظات: ${feedback}` : "";
  await prisma.notification.create({
    data: {
      userId: exam.teacherId,
      title: status === "APPROVED" ? "تم اعتماد الاختبار" : "تم رفض الاختبار",
      message: `تم ${status === "APPROVED" ? "اعتماد" : "رفض"} اختبارك "${
        exam.title
      }" من قبل اللجنة.${noteLine}`,
      type: "status_change",
    },
  });

  return { ok: true, exam };
}
