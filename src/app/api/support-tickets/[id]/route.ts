import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-server";
import { emailUserTicketReply } from "@/lib/support-mail";

export const dynamic = "force-dynamic";

/** رد المشرف على طلب */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    const admin = gate.user;
    if (!admin) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    const id = params.id;
    const body = await req.json();
    const reply =
      typeof body.adminReply === "string" ? body.adminReply.trim() : "";

    if (!reply || reply.length > 8000) {
      return NextResponse.json(
        { error: "نص الرد مطلوب (بحد أقصى ٨٠٠٠ حرف)" },
        { status: 400 }
      );
    }

    const existing = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        adminReply: reply,
        status: "ANSWERED",
        repliedAt: new Date(),
        repliedById: admin.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        repliedBy: { select: { id: true, name: true } },
      },
    });

    await prisma.notification.create({
      data: {
        userId: existing.userId,
        title: "رد على طلب الدعم الفني",
        message: `رد المشرف: ${reply.slice(0, 200)}${reply.length > 200 ? "…" : ""}`,
        type: "support_reply",
      },
    });

    await emailUserTicketReply({
      toEmail: updated.user.email,
      userName: updated.user.name,
      ticketId: updated.id,
      reply,
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    console.error("support-tickets PATCH", e);
    return NextResponse.json({ error: "تعذر حفظ الرد" }, { status: 500 });
  }
}
