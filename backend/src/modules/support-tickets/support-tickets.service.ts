import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { isImageMime } from "@/lib/ai-file-parts";
import { prisma } from "@/lib/prisma";
import {
  SUPPORT_TICKET_MAX_BYTES_PER_FILE,
  SUPPORT_TICKET_MAX_FILES,
  SUPPORT_TICKET_MAX_MESSAGE,
  mediaPublicRoot,
} from "@/lib/support-ticket-upload";
import { emailAdminNewTicket, emailUserTicketReply } from "@/lib/support-mail";

function isUploadFile(v: FormDataEntryValue): v is File {
  return typeof v !== "string" && v instanceof File;
}

export async function listSupportTicketsForActor(userId: string, role: string) {
  if (role === "ADMIN") {
    return prisma.supportTicket.findMany({
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
  }
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { repliedBy: { select: { id: true, name: true } } },
  });
}

export async function createSupportTicketWithUploads(params: {
  userId: string;
  form: FormData;
}): Promise<
  | { ok: true; ticket: Awaited<ReturnType<typeof prisma.supportTicket.update>> }
  | { ok: false; error: string; status: number }
> {
  const { userId, form } = params;
  const messageRaw = form.get("message");
  const message = typeof messageRaw === "string" ? messageRaw.trim() : "";
  if (!message || message.length > SUPPORT_TICKET_MAX_MESSAGE) {
    return {
      ok: false,
      error: "الملاحظات مطلوبة (بحد أقصى ٨٠٠٠ حرف)",
      status: 400,
    };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "المستخدم غير موجود", status: 404 };

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      message,
      attachments: [],
      status: "PENDING",
    },
  });

  const uploadRoot = path.join(mediaPublicRoot(), "uploads", "support", ticket.id);
  await mkdir(uploadRoot, { recursive: true });
  const fileEntries = form.getAll("files").filter(isUploadFile);
  const paths: string[] = [];
  let fileIndex = 0;

  for (const value of fileEntries) {
    if (!value.size) continue;
    if (fileIndex >= SUPPORT_TICKET_MAX_FILES) break;
    if (!isImageMime(value.type || "")) {
      await prisma.supportTicket.delete({ where: { id: ticket.id } });
      return { ok: false, error: "يُسمح بصور فقط (JPEG، PNG، GIF، WebP)", status: 400 };
    }
    if (value.size > SUPPORT_TICKET_MAX_BYTES_PER_FILE) {
      await prisma.supportTicket.delete({ where: { id: ticket.id } });
      return { ok: false, error: "كل صورة يجب ألا تتجاوز ٤ ميجابايت", status: 400 };
    }
    const buf = Buffer.from(await value.arrayBuffer());
    const name = value.name || "upload.png";
    const ext = (name.split(".").pop() || "png").replace(/[^\w]/g, "");
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
      message: `طلب من ${user.name}: ${message.slice(0, 120)}${
        message.length > 120 ? "…" : ""
      }`,
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

  return { ok: true, ticket: updated };
}

export async function adminReplyToTicket(params: {
  ticketId: string;
  adminId: string;
  reply: string;
}): Promise<
  | {
      ok: true;
      ticket: Awaited<ReturnType<typeof prisma.supportTicket.update>> & {
        user: { email: string; name: string };
      };
    }
  | { ok: false; error: string; status: number }
> {
  const { ticketId, adminId, reply } = params;
  if (!reply || reply.length > 8000) {
    return { ok: false, error: "نص الرد مطلوب (بحد أقصى ٨٠٠٠ حرف)", status: 400 };
  }
  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });
  if (!existing) return { ok: false, error: "الطلب غير موجود", status: 404 };

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      adminReply: reply,
      status: "ANSWERED",
      repliedAt: new Date(),
      repliedById: adminId,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
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

  return { ok: true, ticket: updated };
}
