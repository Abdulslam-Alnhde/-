import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";
import { sortExamQuestionsForDisplay } from "@/lib/exam-question-order";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requireRole(["TEACHER"]);
    if (gate.error) return gate.error;

    const teacherId = gate.session!.user.id;

    const exams = await prisma.exam.findMany({
      where: { teacherId },
      include: {
        questions: {
          include: {
            keyPoints: { orderBy: { id: "asc" } },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const withSortedQuestions = exams.map((e) => ({
      ...e,
      questions: sortExamQuestionsForDisplay(e.questions),
    }));

    return NextResponse.json(withSortedQuestions);
  } catch (error) {
    console.error("Fetch Teacher Exams Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch teacher exams" },
      { status: 500 }
    );
  }
}
