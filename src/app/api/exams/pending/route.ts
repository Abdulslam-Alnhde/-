import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requireRole(["COMMITTEE"]);
    if (gate.error) return gate.error;

    const pendingExams = await prisma.exam.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: {
        teacher: true,
        questions: {
          include: { keyPoints: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pendingExams);
  } catch (error) {
    console.error("Fetch Exams Error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}
