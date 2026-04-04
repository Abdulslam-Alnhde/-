import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import { round2, totalQuestionPointsFromKeyPoints } from "@/lib/exam-keypoints-normalize";
import { sortExamQuestionsForDisplay } from "@/lib/exam-question-order";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gate = await requireRole(["TEACHER"]);
    if (gate.error) return gate.error;

    const { id } = params;
    const teacherId = gate.session!.user.id;

    const exam = await prisma.exam.findFirst({
      where: { id, teacherId },
      include: {
        questions: {
          include: {
            keyPoints: { orderBy: { id: "asc" } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "الاختبار غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
      ...exam,
      questions: sortExamQuestionsForDisplay(exam.questions),
    });
  } catch (e) {
    console.error("GET exam:", e);
    return NextResponse.json({ error: "فشل جلب الاختبار" }, { status: 500 });
  }
}

/** Resubmit a rejected exam (replace questions, return to pending approval). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gate = await requireRole(["TEACHER"]);
    if (gate.error) return gate.error;

    const { id } = params;
    const teacherId = gate.session!.user.id;

    const existing = await prisma.exam.findFirst({
      where: { id, teacherId },
    });

    if (!existing) {
      return NextResponse.json({ error: "الاختبار غير موجود" }, { status: 404 });
    }
    if (existing.status !== "REJECTED") {
      return NextResponse.json(
        { error: "يمكن إعادة الإرسال فقط للاختبارات المرفوضة" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, date, type, extractedQuestions, declaredMaxGrade } = body;

    if (!title || !extractedQuestions || !Array.isArray(extractedQuestions)) {
      return NextResponse.json({ error: "الحقول المطلوبة مفقودة" }, { status: 400 });
    }

    const questionCreates = extractedQuestions.map((q: any, qi: number) => {
      const kps = Array.isArray(q.keyPoints) ? q.keyPoints : [];
      const points = totalQuestionPointsFromKeyPoints(
        kps.map((kp: any) => ({ defaultGrade: Number(kp.defaultGrade) || 0 }))
      );
      return {
        content: q.question,
        modelAnswer: q.modelAnswer,
        type: "AI_EXTRACTED" as const,
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

    const totalGrade = round2(
      questionCreates.reduce((s: number, row: { points: number }) => s + row.points, 0)
    );

    if (
      typeof declaredMaxGrade === "number" &&
      Number.isFinite(declaredMaxGrade) &&
      declaredMaxGrade > 0 &&
      totalGrade > declaredMaxGrade + 1e-6
    ) {
      return NextResponse.json(
        {
          error: `مجموع درجات الأسئلة (${totalGrade}) يتجاوز الدرجة الكلية المعتمدة (${declaredMaxGrade}).`,
        },
        { status: 400 }
      );
    }

    const exam = await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { examId: id } });
      return tx.exam.update({
        where: { id },
        data: {
          title,
          description: `Exam Date: ${date ?? ""}`,
          type,
          totalGrade,
          status: "PENDING_APPROVAL",
          committeeFeedback: null,
          questions: {
            create: questionCreates,
          },
        },
        include: {
          questions: {
            include: { keyPoints: true },
          },
        },
      });
    });

    const committeeUsers = await prisma.user.findMany({
      where: { role: "COMMITTEE" },
    });

    if (committeeUsers.length > 0) {
      await prisma.notification.createMany({
        data: committeeUsers.map((user) => ({
          userId: user.id,
          title: "إعادة تقديم اختبار بعد التعديل",
          message: `أعاد المعلم تقديم الاختبار "${exam.title}" بعد الرفض — يرجى المراجعة.`,
          type: "status_change",
        })),
      });
    }

    return NextResponse.json({ success: true, exam });
  } catch (error: unknown) {
    console.error("PATCH exam resubmit:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "فشل تحديث الاختبار" },
      { status: 500 }
    );
  }
}
