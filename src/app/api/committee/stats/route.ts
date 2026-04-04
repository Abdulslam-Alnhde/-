import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requireRole(["COMMITTEE"]);
    if (gate.error) return gate.error;

    const totalPending = await prisma.exam.count({
      where: { status: "PENDING_APPROVAL" },
    });
    const totalApproved = await prisma.exam.count({
      where: { status: "APPROVED" },
    });
    const totalRejected = await prisma.exam.count({
      where: { status: "REJECTED" },
    });

    const recentActivity = await prisma.notification.findMany({
      where: { type: "status_change" },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });

    return NextResponse.json({
      stats: {
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
        totalReviewed: totalApproved + totalRejected,
      },
      recentActivity,
    });
  } catch {
    return NextResponse.json(
      {
        stats: { pending: 0, approved: 0, rejected: 0, totalReviewed: 0 },
        recentActivity: [],
        error: "تعذّر جلب إحصائيات اللجنة",
      },
      { status: 500 }
    );
  }
}
