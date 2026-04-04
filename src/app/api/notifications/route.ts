import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const userId = auth.session!.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch {
    return NextResponse.json(
      { error: "تعذر جلب التنبيهات" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "معرّف الإشعار مطلوب" }, { status: 400 });
    }

    const row = await prisma.notification.findUnique({ where: { id } });
    if (!row || row.userId !== auth.session!.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
