import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listProfileRequestsAdmin() {
  return prisma.profileChangeRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          employeeCode: true,
        },
      },
    },
  });
}

export async function createProfileRequest(params: {
  userId: string;
  payload: unknown;
}): Promise<
  | { ok: true; request: Awaited<ReturnType<typeof prisma.profileChangeRequest.create>> }
  | { ok: false; error: string; status: number; body?: Record<string, unknown> }
> {
  const { userId, payload } = params;
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "بيانات الطلب ناقصة", status: 400 };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "المستخدم غير موجود", status: 404 };
  if (!user.profileLocked) {
    return {
      ok: false,
      error: "حسابك غير مقفل — عدّل بياناتك مباشرة من صفحة الإعدادات",
      status: 400,
      body: {
        error: "حسابك غير مقفل — عدّل بياناتك مباشرة من صفحة الإعدادات",
      },
    };
  }
  const reqRow = await prisma.profileChangeRequest.create({
    data: {
      userId,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
  return { ok: true, request: reqRow };
}

export async function adminReviewProfileRequest(params: {
  id: string;
  reviewerId: string;
  status: unknown;
  adminNote: unknown;
}): Promise<
  | { ok: true; request: Awaited<ReturnType<typeof prisma.profileChangeRequest.update>> }
  | { ok: false; error: string; status: number }
> {
  const { id, reviewerId, status, adminNote } = params;
  if (status !== "APPROVED" && status !== "REJECTED") {
    return { ok: false, error: "حالة غير صالحة", status: 400 };
  }
  const row = await prisma.profileChangeRequest.update({
    where: { id },
    data: {
      status,
      adminNote: typeof adminNote === "string" ? adminNote : null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
  if (status === "APPROVED" && row.payload && typeof row.payload === "object") {
    const p = row.payload as Record<string, unknown>;
    await prisma.user.update({
      where: { id: row.userId },
      data: {
        ...(typeof p.name === "string" && { name: p.name }),
        ...(typeof p.phone === "string" && { phone: p.phone }),
        ...(typeof p.jobTitle === "string" && { jobTitle: p.jobTitle }),
        ...(typeof p.department === "string" && { department: p.department }),
      },
    });
  }
  return { ok: true, request: row };
}
