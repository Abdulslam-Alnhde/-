import { prisma } from "@/lib/prisma";

export async function adminDashboardStats() {
  const totalUsers = await prisma.user.count();
  const totalExams = await prisma.exam.count();
  const totalQuestions = await prisma.question.count();
  const totalNotifications = await prisma.notification.count();
  const roleDistribution = await prisma.user.groupBy({
    by: ["role"],
    _count: { id: true },
  });
  const recentExams = await prisma.exam.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { teacher: true },
  });
  return {
    metrics: { totalUsers, totalExams, totalQuestions, totalNotifications },
    roleDistribution,
    recentExams,
  };
}

export async function committeeDashboardStats() {
  const totalPending = await prisma.exam.count({
    where: { status: "PENDING_APPROVAL" },
  });
  const totalApproved = await prisma.exam.count({ where: { status: "APPROVED" } });
  const totalRejected = await prisma.exam.count({ where: { status: "REJECTED" } });
  const recentActivity = await prisma.notification.findMany({
    where: { type: "status_change" },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  return {
    stats: {
      pending: totalPending,
      approved: totalApproved,
      rejected: totalRejected,
      totalReviewed: totalApproved + totalRejected,
    },
    recentActivity,
  };
}
