import { prisma } from "@/lib/prisma";

export async function listForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function markReadForUser(params: {
  userId: string;
  notificationId: unknown;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  const id = params.notificationId;
  if (!id || typeof id !== "string") {
    return { ok: false, error: "معرّف الإشعار مطلوب", status: 400 };
  }
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row || row.userId !== params.userId) {
    return { ok: false, error: "غير مصرح", status: 403 };
  }
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return { ok: true };
}
