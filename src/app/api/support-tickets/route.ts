import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-server";
import { emailAdminNewTicket } from "@/lib/support-mail";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 8000;
const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024;

function isImageMime(m: string) {
  return /^image\/(jpeg|png|gif|webp)$/i.test(m);
}

/** قائمة الطلبات: المشرف يرى الكل، غيره يرى طلباته فقط */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const role = auth.session!.user.role;
    const userId = auth.session!.user.id;

    if (role === "ADMIN") {
      const gate = await requireRole(["ADMIN"]);
      if (gate.error) return gate.error;
      const tickets = await prisma.supportTicket.findMany({
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
          repliedBy: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json(tickets);
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        repliedBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(tickets);
  } catch {
    return NextResponse.json(
      { error: "تعذر جلب طلبات الدعم" },
      { status: 500 }
    );
  }
}

/** إنشاء طلب مع مرفقات صور */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const userId = auth.session!.user.id;
    const form = await req.formData();
    const messageRaw = form.get("message");
    const message =
      typeof messageRaw === "string" ? messageRaw.trim() : "";

    if (!message || message.length > MAX_MESSAGE) {
      return NextResponse.json(
        { error: "الملاحظات مطلوبة (بحد أقصى ٨٠٠٠ حرف)" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        message,
        attachments: [],
        status: "PENDING",
      },
    });

    const uploadRoot = path.join(process.cwd(), "public", "uploads", "support", ticket.id);
    await mkdir(uploadRoot, { recursive: true });

    const fileEntries = form.getAll("files").filter((v): v is File => v instanceof File);

    const paths: string[] = [];
    let fileIndex = 0;
    for (const value of fileEntries) {
      if (!value.size) continue;
      if (fileIndex >= MAX_FILES) break;
      if (!isImageMime(value.type || "")) {
        await prisma.supportTicket.delete({ where: { id: ticket.id } });
        return NextResponse.json(
          { error: "يُسمح بصور فقط (JPEG، PNG، GIF، WebP)" },
          { status: 400 }
        );
      }
      if (value.size > MAX_BYTES) {
        await prisma.supportTicket.delete({ where: { id: ticket.id } });
        return NextResponse.json(
          { error: "كل صورة يجب ألا تتجاوز ٤ ميجابايت" },
          { status: 400 }
        );
      }
      const buf = Buffer.from(await value.arrayBuffer());
      const ext = (value.name.split(".").pop() || "png").replace(/[^\w]/g, "");
      const safeName = `${fileIndex}-${Date.now()}.${ext || "png"}`;
      const diskPath = path.join(uploadRoot, safeName);
      await writeFile(diskPath, buf);
      paths.push(`/uploads/support/${ticket.id}/${safeName}`);
      fileIndex += 1;
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { attachments: paths },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: "طلب دعم فني جديد",
        message: `طلب من ${user.name}: ${message.slice(0, 120)}${message.length > 120 ? "…" : ""}`,
        type: "support_ticket",
      })),
    });

    await emailAdminNewTicket({
      ticketId: updated.id,
      fromName: user.name,
      fromEmail: user.email,
      message: updated.message,
      attachmentCount: paths.length,
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    console.error("support-tickets POST", e);
    return NextResponse.json(
      { error: "تعذر إرسال الطلب" },
      { status: 500 }
    );
  }
}
