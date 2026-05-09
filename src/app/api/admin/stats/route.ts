import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireRole } from "@/lib/auth-server";
import { canAdminPanelAction } from "@/lib/admin-user-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "list")) {
      return forbidden();
    }

    const totalUsers = await prisma.user.count();
    const totalExams = await prisma.exam.count();
    const totalQuestions = await prisma.question.count();
    const totalNotifications = await prisma.notification.count();

    const roleDistribution = await prisma.user.groupBy({
      by: ["role"],
      _count: {
        id: true,
      },
    });

    const recentExams = await prisma.exam.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { teacher: true },
    });

    return NextResponse.json({
      metrics: {
        totalUsers,
        totalExams,
        totalQuestions,
        totalNotifications,
      },
      roleDistribution,
      recentExams,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 }
    );
  }
}
