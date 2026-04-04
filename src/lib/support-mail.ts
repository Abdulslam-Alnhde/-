import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : 587;
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const toAddress = () =>
  process.env.SUPPORT_TO_EMAIL?.trim() || process.env.SMTP_USER?.trim() || "";

export async function emailAdminNewTicket(params: {
  ticketId: string;
  fromName: string;
  fromEmail: string;
  message: string;
  attachmentCount: number;
}) {
  const to = toAddress();
  const transport = getTransport();
  if (!transport || !to) {
    console.info(
      "[support-mail] SMTP أو SUPPORT_TO_EMAIL غير مضبوط — تم حفظ الطلب فقط."
    );
    return;
  }
  const from =
    process.env.SUPPORT_FROM_EMAIL?.trim() || process.env.SMTP_USER!.trim();
  await transport.sendMail({
    from,
    to,
    subject: `[دعم فني] طلب جديد من ${params.fromName}`,
    text: [
      `رقم الطلب: ${params.ticketId}`,
      `من: ${params.fromName} <${params.fromEmail}>`,
      `مرفقات (صور): ${params.attachmentCount}`,
      "",
      params.message,
    ].join("\n"),
  });
}

export async function emailUserTicketReply(params: {
  toEmail: string;
  userName: string;
  ticketId: string;
  reply: string;
}) {
  const transport = getTransport();
  const from =
    process.env.SUPPORT_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim();
  if (!transport || !from) {
    console.info("[support-mail] SMTP غير مضبوط — إشعار المستخدم عبر التطبيق فقط.");
    return;
  }
  await transport.sendMail({
    from,
    to: params.toEmail,
    subject: "رد على طلب الدعم الفني",
    text: [
      `مرحباً ${params.userName}،`,
      "",
      `رد المشرف على طلبك (${params.ticketId}):`,
      "",
      params.reply,
      "",
      "— منصة جامعة العرب",
    ].join("\n"),
  });
}
