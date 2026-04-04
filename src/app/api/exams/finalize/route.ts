import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import { round2, totalQuestionPointsFromKeyPoints } from "@/lib/exam-keypoints-normalize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireRole(["TEACHER"]);
    if (gate.error) return gate.error;

    const teacherId = gate.session!.user.id;

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

    /** درجة الاختبار = مجموع درجات الأسئلة (مجموع المحاور) حتى لا تختلف عن مجموع النموذج */
    const totalGrade = round2(
      questionCreates.reduce((s, row) => s + row.points, 0)
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

    const exam = await prisma.exam.create({
      data: {
        title,
        description: `Exam Date: ${date}`,
        type,
        totalGrade,
        status: "PENDING_APPROVAL",
        teacher: { connect: { id: teacherId } },
        questions: {
          create: questionCreates,
        },
      },
      include: {
        questions: {
          include: {
            keyPoints: true,
          },
        },
      },
    });

    const committeeUsers = await prisma.user.findMany({
      where: { role: "COMMITTEE" },
    });

    if (committeeUsers.length > 0) {
      await prisma.notification.createMany({
        data: committeeUsers.map((user) => ({
          userId: user.id,
          title: "طلب اعتماد اختبار جديد",
          message: `تم تقديم اختبار جديد بعنوان "${exam.title}" وهو بانتظار مراجعتك واعتمادك.`,
          type: "status_change",
        })),
      });
    }

    return NextResponse.json({ success: true, exam });
  } catch (error: any) {
    console.error("Database Save Error:", error);
    return NextResponse.json(
      { error: error?.message || "فشل حفظ الاختبار" },
      { status: 500 }
    );
  }
}
