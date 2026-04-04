import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";
import { hasPermission, PERMISSION_KEYS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const gate = await requireRole(["COMMITTEE"]);
    if (gate.error) return gate.error;

    const reviewer = gate.user;
    if (!reviewer) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (
      !hasPermission(
        reviewer.role,
        reviewer.permissionKeys,
        PERMISSION_KEYS.APPROVE_EXAMS
      )
    ) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية اعتماد أو رفض الاختبارات" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const examId = body.examId as string | undefined;
    const status = body.status as "APPROVED" | "REJECTED" | undefined;
    const feedbackRaw = body.feedback;
    const feedback =
      typeof feedbackRaw === "string" ? feedbackRaw.trim() : "";

    if (!examId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    if (status === "REJECTED" && !feedback) {
      return NextResponse.json(
        { error: "سبب الرفض مطلوب (ملاحظة للمعلم)" },
        { status: 400 }
      );
    }

    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        status,
        committeeFeedback: status === "REJECTED" ? feedback : null,
      } as Parameters<typeof prisma.exam.update>[0]["data"],
      include: { teacher: true },
    });

    const noteLine =
      status === "REJECTED" && feedback
        ? ` الملاحظات: ${feedback}`
        : "";

    await prisma.notification.create({
      data: {
        userId: exam.teacherId,
        title:
          status === "APPROVED" ? "تم اعتماد الاختبار" : "تم رفض الاختبار",
        message: `تم ${status === "APPROVED" ? "اعتماد" : "رفض"} اختبارك "${exam.title}" من قبل اللجنة.${noteLine}`,
        type: "status_change",
      },
    });

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    console.error("Approve Exam Error:", error);
    return NextResponse.json(
      { error: "فشل في تحديث حالة الاختبار" },
      { status: 500 }
    );
  }
}
