/** Registers all JSON API routes under `/api` (Hono), after internal auth middleware. */
import { Hono } from "hono";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { canAdminPanelAction } from "@/lib/admin-user-actions";
import {
  COMMITTEE_PERMISSION_KEYS,
  PERMISSION_KEYS,
  hasPermission,
  sanitizeKeysForRole,
  PERMISSION_LABELS_AR,
} from "@/lib/permissions";
import { emailAdminNewTicket, emailUserTicketReply } from "@/lib/support-mail";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import {
  questionTotalPoints,
  round2,
  totalQuestionPointsFromKeyPoints,
} from "@/lib/exam-scoring";
import { sortExamQuestionsForDisplay } from "@/lib/exam-question-order";
import { runTeacherExtraction } from "@/lib/extract-teacher-runner";
import { runGrading } from "@/lib/grading-runner";
import { handleExtractStudent } from "@/modules/student-extraction/student-extraction.handler";
import { internalOnly } from "@/common/middleware/internal-auth.middleware";
import { actingSubject, type ApiActor } from "@/common/types";
import { forbidden, jsonError } from "@/common/http";
import { requireRoles } from "@/common/guards";
import bcrypt from "bcryptjs";

function mediaPublicRoot() {
  if (process.env.MEDIA_PUBLIC_ROOT) {
    return path.resolve(process.env.MEDIA_PUBLIC_ROOT);
  }
  return path.resolve(process.cwd(), "..", "frontend", "public");
}

const MAX_MESSAGE = 8000;
const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024;

function isImageMime(m: string) {
  return /^image\/(jpeg|png|gif|webp)$/i.test(m);
}

export function registerAllRoutes(root: Hono) {
  const api = new Hono<{ Variables: { actor: ApiActor } }>();
  api.use("*", internalOnly);

  api.get("/colleges", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "list")) return forbidden(c);
    try {
      const colleges = await prisma.college.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return c.json(colleges);
    } catch {
      return jsonError(c, "تعذر جلب الكليات", 500);
    }
  });

  api.get("/permissions", async (c) => {
    const list = Object.values(PERMISSION_KEYS).map((key) => ({
      key,
      labelAr: PERMISSION_LABELS_AR[key] || key,
    }));
    return c.json(list);
  });

  api.get("/users/me", async (c) => {
    const actor = c.get("actor");
    try {
      const user = await prisma.user.findUnique({
        where: { id: actor.userId },
        include: { college: { select: { id: true, name: true } } },
      });
      if (!user) return jsonError(c, "المستخدم غير موجود", 404);
      return c.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeCode: user.employeeCode,
        collegeId: user.collegeId,
        college: user.college,
        department: user.department,
        jobTitle: user.jobTitle,
        phone: user.phone,
        permissionKeys: user.permissionKeys ?? [],
        profileLocked: user.profileLocked ?? true,
      });
    } catch {
      return jsonError(c, "تعذر جلب بيانات المستخدم", 500);
    }
  });

  api.patch("/users/me", async (c) => {
    const actor = c.get("actor");
    try {
      const user = await prisma.user.findUnique({
        where: { id: actor.userId },
      });
      if (!user) return jsonError(c, "المستخدم غير موجود", 404);
      if (user.profileLocked) {
        return c.json(
          {
            error:
              "الحساب مقفل للتعديل المباشر. أرسل طلب تعديل من صفحة الإعدادات أو راجع المشرف.",
          },
          403
        );
      }
      const body = await c.req.json();
      const { name, phone, department, jobTitle } = body;
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(typeof name === "string" && { name: name.trim() }),
          ...(typeof phone === "string" && { phone: phone.trim() || null }),
          ...(typeof department === "string" && {
            department: department.trim() || null,
          }),
          ...(typeof jobTitle === "string" && { jobTitle: jobTitle.trim() || null }),
        },
      });
      return c.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        employeeCode: updated.employeeCode,
        department: updated.department,
        jobTitle: updated.jobTitle,
        phone: updated.phone,
        permissionKeys: updated.permissionKeys ?? [],
        profileLocked: updated.profileLocked ?? true,
      });
    } catch {
      return jsonError(c, "تعذر حفظ التعديلات", 500);
    }
  });

  api.get("/users", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "list")) return forbidden(c);
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { college: { select: { id: true, name: true } } },
      });
      const safe = users.map(({ passwordHash: _, ...u }) => u);
      return c.json(safe);
    } catch {
      return jsonError(c, "تعذر جلب المستخدمين", 500);
    }
  });

  api.post("/users", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "create")) return forbidden(c);
    try {
      const body = await c.req.json();
      const {
        name,
        email,
        role,
        employeeCode,
        collegeId,
        department,
        jobTitle,
        phone,
        permissionKeys,
        profileLocked,
        password,
      } = body;
      if (!name || !email || !role) {
        return jsonError(c, "الاسم والبريد والدور مطلوبة", 400);
      }
      if (!password || typeof password !== "string" || password.length < 6) {
        return jsonError(c, "كلمة مرور مطلوبة (6 أحرف على الأقل)", 400);
      }
      const code = typeof employeeCode === "string" ? employeeCode.trim() : "";
      if (!code) return jsonError(c, "الرقم الوظيفي مطلوب", 400);
      if (!collegeId || typeof collegeId !== "string") {
        return jsonError(c, "يجب اختيار الكلية", 400);
      }
      const college = await prisma.college.findUnique({
        where: { id: collegeId },
      });
      if (!college) return jsonError(c, "الكلية غير صالحة", 400);
      const passwordHash = await hashPassword(password);
      const roleTyped = role as Role;
      const rawKeys = Array.isArray(permissionKeys) ? permissionKeys : [];
      let keys = sanitizeKeysForRole(roleTyped, rawKeys);
      if (roleTyped === "ADMIN" && keys.length === 0) {
        keys = [PERMISSION_KEYS.MANAGE_USERS];
      }
      if (roleTyped === "COMMITTEE" && keys.length === 0) {
        keys = [...COMMITTEE_PERMISSION_KEYS];
      }
      const user = await prisma.user.create({
        data: {
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          role: roleTyped,
          passwordHash,
          employeeCode: code,
          collegeId,
          department: department || null,
          jobTitle: jobTitle || null,
          phone: phone || null,
          permissionKeys: keys,
          profileLocked: typeof profileLocked === "boolean" ? profileLocked : true,
        },
        include: { college: { select: { id: true, name: true } } },
      });
      const { passwordHash: _, ...rest } = user;
      return c.json({ success: true, user: rest });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "P2002") {
        return c.json(
          {
            error:
              "الرقم الوظيفي أو البريد الإلكتروني مسجل مسبقاً — تحقق من عدم تكرار المعرّف.",
          },
          400
        );
      }
      return jsonError(c, "فشل إنشاء المستخدم", 500);
    }
  });

  api.patch("/users/:id", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "edit")) return forbidden(c);
    const id = c.req.param("id");
    if (id === actor.userId) {
      return jsonError(c, "لا يمكنك تعديل حسابك من هذه القائمة", 400);
    }
    try {
      const body = await c.req.json();
      const {
        name,
        email,
        role,
        employeeCode,
        collegeId,
        department,
        jobTitle,
        phone,
        nationalId,
        hireDate,
        permissionKeys,
        profileLocked,
        password,
      } = body;
      const code =
        employeeCode !== undefined ? String(employeeCode).trim() : undefined;
      if (code !== undefined && !code) {
        return jsonError(c, "الرقم الوظيفي لا يمكن أن يكون فارغاً", 400);
      }
      if (collegeId !== undefined && collegeId !== null && collegeId !== "") {
        const col = await prisma.college.findUnique({ where: { id: collegeId } });
        if (!col) return jsonError(c, "الكلية غير صالحة", 400);
      }
      const data: Record<string, unknown> = {};
      if (typeof name === "string") data.name = name.trim();
      if (typeof email === "string") data.email = email.trim();
      if (role === "TEACHER" || role === "COMMITTEE" || role === "ADMIN")
        data.role = role as Role;
      if (code !== undefined) data.employeeCode = code;
      if (collegeId !== undefined) data.collegeId = collegeId || null;
      if (department !== undefined) data.department = department || null;
      if (jobTitle !== undefined) data.jobTitle = jobTitle || null;
      if (phone !== undefined) data.phone = phone || null;
      if (nationalId !== undefined) data.nationalId = nationalId || null;
      if (hireDate !== undefined && hireDate !== null)
        data.hireDate = new Date(hireDate);
      const nextRole = (data.role as Role | undefined) ?? undefined;
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return jsonError(c, "غير موجود", 404);
      const effectiveRole = (nextRole ?? existing.role) as Role;
      if (effectiveRole === "TEACHER") {
        data.permissionKeys = [];
      } else if (Array.isArray(permissionKeys)) {
        let nextKeys = sanitizeKeysForRole(effectiveRole, permissionKeys);
        if (effectiveRole === "ADMIN" && nextKeys.length === 0) {
          nextKeys = [PERMISSION_KEYS.MANAGE_USERS];
        }
        if (effectiveRole === "COMMITTEE" && nextKeys.length === 0) {
          nextKeys = [...COMMITTEE_PERMISSION_KEYS];
        }
        data.permissionKeys = nextKeys;
      }
      if (typeof profileLocked === "boolean") data.profileLocked = profileLocked;
      if (typeof password === "string" && password.length > 0) {
        data.passwordHash = await hashPassword(password);
      }
      const user = await prisma.user.update({
        where: { id },
        data: data as Parameters<typeof prisma.user.update>[0]["data"],
        include: { college: { select: { id: true, name: true } } },
      });
      const { passwordHash: __, ...rest } = user;
      return c.json({ success: true, user: rest });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return jsonError(c, "البريد أو الرقم الوظيفي مستخدم مسبقاً", 400);
      }
      return jsonError(c, "تعذر تحديث المستخدم", 500);
    }
  });

  api.delete("/users/:id", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "delete")) return forbidden(c);
    const id = c.req.param("id");
    if (id === actor.userId) return jsonError(c, "لا يمكنك حذف حسابك", 400);
    try {
      await prisma.user.delete({ where: { id } });
      return c.json({ success: true });
    } catch {
      return jsonError(c, "تعذر حذف المستخدم", 500);
    }
  });

  api.get("/profile-requests", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "list")) return forbidden(c);
    try {
      const requests = await prisma.profileChangeRequest.findMany({
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
      return c.json(requests);
    } catch {
      return jsonError(c, "تعذر جلب الطلبات", 500);
    }
  });

  api.post("/profile-requests", async (c) => {
    const actor = c.get("actor");
    try {
      const body = await c.req.json();
      const { userId, payload } = body;
      if (!userId || !payload || typeof payload !== "object") {
        return jsonError(c, "بيانات الطلب ناقصة", 400);
      }
      if (userId !== actor.userId) return jsonError(c, "غير مصرح", 403);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return jsonError(c, "المستخدم غير موجود", 404);
      if (!user.profileLocked) {
        return c.json(
          {
            error:
              "حسابك غير مقفل — عدّل بياناتك مباشرة من صفحة الإعدادات",
          },
          400
        );
      }
      const reqRow = await prisma.profileChangeRequest.create({
        data: { userId, payload, status: "PENDING" },
      });
      return c.json({ success: true, request: reqRow });
    } catch {
      return jsonError(c, "تعذر إنشاء الطلب", 500);
    }
  });

  api.patch("/profile-requests/:id", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "edit")) return forbidden(c);
    const rid = c.req.param("id");
    const reviewerId = actor.userId;
    try {
      const { status, adminNote } = await c.req.json();
      if (status !== "APPROVED" && status !== "REJECTED") {
        return jsonError(c, "حالة غير صالحة", 400);
      }
      const row = await prisma.profileChangeRequest.update({
        where: { id: rid },
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
      return c.json({ success: true, request: row });
    } catch {
      return jsonError(c, "تعذر تحديث الطلب", 500);
    }
  });

  api.get("/support-tickets", async (c) => {
    const actor = c.get("actor");
    try {
      if (actor.role === "ADMIN") {
        const gate = requireRoles(c, actor, ["ADMIN"]);
        if (gate) return gate;
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
        return c.json(tickets);
      }
      const tickets = await prisma.supportTicket.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: "desc" },
        include: { repliedBy: { select: { id: true, name: true } } },
      });
      return c.json(tickets);
    } catch {
      return jsonError(c, "تعذر جلب طلبات الدعم", 500);
    }
  });

  api.post("/support-tickets", async (c) => {
    const actor = c.get("actor");
    try {
      const userId = actor.userId;
      const form = await c.req.formData();
      const messageRaw = form.get("message");
      const message = typeof messageRaw === "string" ? messageRaw.trim() : "";
      if (!message || message.length > MAX_MESSAGE) {
        return jsonError(c, "الملاحظات مطلوبة (بحد أقصى ٨٠٠٠ حرف)", 400);
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return jsonError(c, "المستخدم غير موجود", 404);
      const ticket = await prisma.supportTicket.create({
        data: {
          userId,
          message,
          attachments: [],
          status: "PENDING",
        },
      });
      const uploadRoot = path.join(
        mediaPublicRoot(),
        "uploads",
        "support",
        ticket.id
      );
      await mkdir(uploadRoot, { recursive: true });
      const fileEntries = form.getAll("files").filter((v): v is File => v instanceof File);
      const paths: string[] = [];
      let fileIndex = 0;
      for (const value of fileEntries) {
        if (!value.size) continue;
        if (fileIndex >= MAX_FILES) break;
        if (!isImageMime(value.type || "")) {
          await prisma.supportTicket.delete({ where: { id: ticket.id } });
          return jsonError(c, "يُسمح بصور فقط (JPEG، PNG، GIF، WebP)", 400);
        }
        if (value.size > MAX_BYTES) {
          await prisma.supportTicket.delete({ where: { id: ticket.id } });
          return jsonError(c, "كل صورة يجب ألا تتجاوز ٤ ميجابايت", 400);
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
      return c.json(updated);
    } catch (e) {
      console.error("support-tickets POST", e);
      return jsonError(c, "تعذر إرسال الطلب", 500);
    }
  });

  api.patch("/support-tickets/:id", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const admin = actingSubject(actor);
    const id = c.req.param("id");
    try {
      const body = await c.req.json();
      const reply = typeof body.adminReply === "string" ? body.adminReply.trim() : "";
      if (!reply || reply.length > 8000) {
        return jsonError(c, "نص الرد مطلوب (بحد أقصى ٨٠٠٠ حرف)", 400);
      }
      const existing = await prisma.supportTicket.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!existing) return jsonError(c, "الطلب غير موجود", 404);
      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          adminReply: reply,
          status: "ANSWERED",
          repliedAt: new Date(),
          repliedById: admin.id,
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
      return c.json(updated);
    } catch (e) {
      console.error("support-tickets PATCH", e);
      return jsonError(c, "تعذر حفظ الرد", 500);
    }
  });

  api.get("/notifications", async (c) => {
    const actor = c.get("actor");
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: "desc" },
      });
      return c.json(notifications);
    } catch {
      return jsonError(c, "تعذر جلب التنبيهات", 500);
    }
  });

  api.patch("/notifications", async (c) => {
    const actor = c.get("actor");
    try {
      const { id } = await c.req.json();
      if (!id) return jsonError(c, "معرّف الإشعار مطلوب", 400);
      const row = await prisma.notification.findUnique({ where: { id } });
      if (!row || row.userId !== actor.userId) return jsonError(c, "غير مصرح", 403);
      await prisma.notification.update({ where: { id }, data: { isRead: true } });
      return c.json({ success: true });
    } catch {
      return c.json({ error: "Failed to update notification" }, 500);
    }
  });

  api.get("/exams/teacher", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["TEACHER"]);
    if (gate) return gate;
    try {
      const teacherId = actor.userId;
      const exams = await prisma.exam.findMany({
        where: { teacherId },
        include: {
          questions: {
            include: { keyPoints: { orderBy: { id: "asc" } } },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const withSortedQuestions = exams.map((e) => ({
        ...e,
        questions: sortExamQuestionsForDisplay(e.questions),
      }));
      return c.json(withSortedQuestions);
    } catch (error) {
      console.error("Fetch Teacher Exams Error:", error);
      return jsonError(c, "Failed to fetch teacher exams", 500);
    }
  });

  api.get("/exams/pending", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["COMMITTEE"]);
    if (gate) return gate;
    try {
      const pendingExams = await prisma.exam.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: { teacher: true, questions: { include: { keyPoints: true } } },
        orderBy: { createdAt: "desc" },
      });
      return c.json(pendingExams);
    } catch (error) {
      console.error("Fetch Exams Error:", error);
      return jsonError(c, "Failed to fetch exams", 500);
    }
  });

  api.get("/exams/:id", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["TEACHER"]);
    if (gate) return gate;
    const id = c.req.param("id");
    try {
      const teacherId = actor.userId;
      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        include: {
          questions: {
            include: { keyPoints: { orderBy: { id: "asc" } } },
            orderBy: { id: "asc" },
          },
        },
      });
      if (!exam) return jsonError(c, "الاختبار غير موجود", 404);
      return c.json({
        ...exam,
        questions: sortExamQuestionsForDisplay(exam.questions),
      });
    } catch (e) {
      console.error("GET exam:", e);
      return jsonError(c, "فشل جلب الاختبار", 500);
    }
  });

  api.patch("/exams/:id", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["TEACHER"]);
    if (gate) return gate;
    const id = c.req.param("id");
    const teacherId = actor.userId;
    try {
      const existing = await prisma.exam.findFirst({ where: { id, teacherId } });
      if (!existing) return jsonError(c, "الاختبار غير موجود", 404);
      if (existing.status !== "REJECTED") {
        return jsonError(c, "يمكن إعادة الإرسال فقط للاختبارات المرفوضة", 400);
      }
      const body = await c.req.json();
      const { title, date, type, extractedQuestions, declaredMaxGrade } = body;
      if (!title || !extractedQuestions || !Array.isArray(extractedQuestions)) {
        return jsonError(c, "الحقول المطلوبة مفقودة", 400);
      }
      const questionCreates = extractedQuestions.map((q: any, qi: number) => {
        const kps = Array.isArray(q.keyPoints) ? q.keyPoints : [];
        const points =
          kps.length > 0
            ? totalQuestionPointsFromKeyPoints(
                kps.map((kp: any) => ({ defaultGrade: Number(kp.defaultGrade) || 0 }))
              )
            : questionTotalPoints({
                keyPoints: [],
                questionMaxPoints: Number(q.questionMaxPoints) || 0,
              });
        return {
          content: q.question,
          modelAnswer: q.modelAnswer,
          type:
            q.questionType === "OBJECTIVE"
              ? ("OBJECTIVE" as const)
              : ("AI_EXTRACTED" as const),
          points,
          displayLabel: getQuestionDisplayLabel(q, qi),
          teacherNote: q.teacherNote?.trim() || null,
          keyPoints: {
            create: kps.map((kp: any) => ({
              point: String(kp.point ?? ""),
              grade: round2(Number(kp.defaultGrade) || 0),
            })),
          },
        };
      });
      const totalGrade = round2(
        questionCreates.reduce((s: number, row: { points: number }) => s + row.points, 0)
      );
      if (
        typeof declaredMaxGrade === "number" &&
        Number.isFinite(declaredMaxGrade) &&
        declaredMaxGrade > 0 &&
        totalGrade > declaredMaxGrade + 1e-6
      ) {
        return c.json(
          {
            error: `مجموع درجات الأسئلة (${totalGrade}) يتجاوز الدرجة الكلية المعتمدة (${declaredMaxGrade}).`,
          },
          400
        );
      }
      const exam = await prisma.$transaction(async (tx) => {
        await tx.question.deleteMany({ where: { examId: id } });
        return tx.exam.update({
          where: { id },
          data: {
            title,
            description: `Exam Date: ${date ?? ""}`,
            type,
            totalGrade,
            status: "PENDING_APPROVAL",
            committeeFeedback: null,
            questions: { create: questionCreates },
          },
          include: { questions: { include: { keyPoints: true } } },
        });
      });
      const committeeUsers = await prisma.user.findMany({ where: { role: "COMMITTEE" } });
      if (committeeUsers.length > 0) {
        await prisma.notification.createMany({
          data: committeeUsers.map((user) => ({
            userId: user.id,
            title: "إعادة تقديم اختبار بعد التعديل",
            message: `أعاد المعلم تقديم الاختبار "${exam.title}" بعد الرفض — يرجى المراجعة.`,
            type: "status_change",
          })),
        });
      }
      return c.json({ success: true, exam });
    } catch (error: unknown) {
      console.error("PATCH exam resubmit:", error);
      return c.json(
        { error: (error as Error)?.message || "فشل تحديث الاختبار" },
        500
      );
    }
  });

  api.post("/exams/finalize", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["TEACHER"]);
    if (gate) return gate;
    const teacherId = actor.userId;
    try {
      const body = await c.req.json();
      const { title, date, type, extractedQuestions, declaredMaxGrade } = body;
      if (!title || !extractedQuestions || !Array.isArray(extractedQuestions)) {
        return jsonError(c, "الحقول المطلوبة مفقودة", 400);
      }
      const questionCreates = extractedQuestions.map((q: any, qi: number) => {
        const kps = Array.isArray(q.keyPoints) ? q.keyPoints : [];
        const points =
          kps.length > 0
            ? totalQuestionPointsFromKeyPoints(
                kps.map((kp: any) => ({ defaultGrade: Number(kp.defaultGrade) || 0 }))
              )
            : questionTotalPoints({
                keyPoints: [],
                questionMaxPoints: Number(q.questionMaxPoints) || 0,
              });
        return {
          content: q.question,
          modelAnswer: q.modelAnswer,
          type:
            q.questionType === "OBJECTIVE"
              ? ("OBJECTIVE" as const)
              : ("AI_EXTRACTED" as const),
          points,
          displayLabel: getQuestionDisplayLabel(q, qi),
          teacherNote: q.teacherNote?.trim() || null,
          keyPoints: {
            create: kps.map((kp: any) => ({
              point: String(kp.point ?? ""),
              grade: round2(Number(kp.defaultGrade) || 0),
            })),
          },
        };
      });
      const totalGrade = round2(questionCreates.reduce((s, row) => s + row.points, 0));
      if (
        typeof declaredMaxGrade === "number" &&
        Number.isFinite(declaredMaxGrade) &&
        declaredMaxGrade > 0 &&
        totalGrade > declaredMaxGrade + 1e-6
      ) {
        return c.json(
          {
            error: `مجموع درجات الأسئلة (${totalGrade}) يتجاوز الدرجة الكلية المعتمدة (${declaredMaxGrade}).`,
          },
          400
        );
      }
      const exam = await prisma.exam.create({
        data: {
          title,
          description: `Exam Date: ${date}`,
          type,
          totalGrade,
          status: "PENDING_APPROVAL",
          teacher: { connect: { id: teacherId } },
          questions: { create: questionCreates },
        },
        include: { questions: { include: { keyPoints: true } } },
      });
      const committeeUsers = await prisma.user.findMany({ where: { role: "COMMITTEE" } });
      if (committeeUsers.length > 0) {
        await prisma.notification.createMany({
          data: committeeUsers.map((user) => ({
            userId: user.id,
            title: "طلب اعتماد اختبار جديد",
            message: `تم تقديم اختبار جديد بعنوان "${exam.title}" وهو بانتظار مراجعتك واعتمادك.`,
            type: "status_change",
          })),
        });
      }
      return c.json({ success: true, exam });
    } catch (error: any) {
      console.error("Database Save Error:", error);
      return jsonError(c, error?.message || "فشل حفظ الاختبار", 500);
    }
  });

  api.post("/exams/approve", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["COMMITTEE"]);
    if (gate) return gate;
    const reviewer = actingSubject(actor);
    try {
      if (
        !hasPermission(
          reviewer.role,
          reviewer.permissionKeys ?? [],
          PERMISSION_KEYS.APPROVE_EXAMS
        )
      ) {
        return jsonError(c, "ليس لديك صلاحية اعتماد أو رفض الاختبارات", 403);
      }
      const body = await c.req.json();
      const examId = body.examId as string | undefined;
      const status = body.status as "APPROVED" | "REJECTED" | undefined;
      const feedbackRaw = body.feedback;
      const feedback = typeof feedbackRaw === "string" ? feedbackRaw.trim() : "";
      if (!examId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
        return jsonError(c, "بيانات غير صالحة", 400);
      }
      if (status === "REJECTED" && !feedback) {
        return jsonError(c, "سبب الرفض مطلوب (ملاحظة للمعلم)", 400);
      }
      const exam = await prisma.exam.update({
        where: { id: examId },
        data: {
          status,
          committeeFeedback: status === "REJECTED" ? feedback : null,
        } as Parameters<typeof prisma.exam.update>[0]["data"],
        include: { teacher: true },
      });
      const noteLine = status === "REJECTED" && feedback ? ` الملاحظات: ${feedback}` : "";
      await prisma.notification.create({
        data: {
          userId: exam.teacherId,
          title: status === "APPROVED" ? "تم اعتماد الاختبار" : "تم رفض الاختبار",
          message: `تم ${status === "APPROVED" ? "اعتماد" : "رفض"} اختبارك "${
            exam.title
          }" من قبل اللجنة.${noteLine}`,
          type: "status_change",
        },
      });
      return c.json({ success: true, exam });
    } catch (error) {
      console.error("Approve Exam Error:", error);
      return jsonError(c, "فشل في تحديث حالة الاختبار", 500);
    }
  });

  api.get("/admin/stats", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["ADMIN"]);
    if (gate) return gate;
    const subj = actingSubject(actor);
    if (!canAdminPanelAction(subj, "list")) return forbidden(c);
    try {
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
      return c.json({
        metrics: { totalUsers, totalExams, totalQuestions, totalNotifications },
        roleDistribution,
        recentExams,
      });
    } catch {
      return jsonError(c, "Failed to fetch admin stats", 500);
    }
  });

  api.get("/committee/stats", async (c) => {
    const actor = c.get("actor");
    const gate = requireRoles(c, actor, ["COMMITTEE"]);
    if (gate) return gate;
    try {
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
      return c.json({
        stats: {
          pending: totalPending,
          approved: totalApproved,
          rejected: totalRejected,
          totalReviewed: totalApproved + totalRejected,
        },
        recentActivity,
      });
    } catch {
      return c.json(
        {
          stats: { pending: 0, approved: 0, rejected: 0, totalReviewed: 0 },
          recentActivity: [],
          error: "تعذّر جلب إحصائيات اللجنة",
        },
        500
      );
    }
  });

  api.post("/services/extract-teacher", async (c) => runTeacherExtraction(c.req.raw));
  api.post("/services/extract-student", async (c) => handleExtractStudent(c.req.raw));
  api.post("/services/grading", async (c) => runGrading(c.req.raw));

  api.post("/extract", async (c) => runTeacherExtraction(c.req.raw));
  api.post("/extract-student", async (c) => handleExtractStudent(c.req.raw));
  api.post("/grade", async (c) => runGrading(c.req.raw));

  api.get("/debug/init-admin", async (c) => {
    const secret = c.req.query("secret");
    const expected = process.env.DEBUG_INIT_ADMIN_SECRET;
    if (!expected || secret !== expected) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    try {
      const passwordPlain =
        process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || "ChangeMe!";
      const adminId = process.env.ADMIN_BOOTSTRAP_EMPLOYEE_CODE || "1001";
      const passwordHash = bcrypt.hashSync(passwordPlain, 12);
      let college = await prisma.college.findFirst();
      if (!college) {
        college = await prisma.college.create({
          data: { name: "كلية علوم الحاسب والمعلومات", sortOrder: 0 },
        });
      }
      const admin = await prisma.user.upsert({
        where: { employeeCode: adminId },
        update: { passwordHash, role: "ADMIN" },
        create: {
          employeeCode: adminId,
          name: "مشرف النظام",
          email: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@university.edu",
          role: "ADMIN",
          passwordHash,
          collegeId: college.id,
          department: "إدارة النظام",
          jobTitle: "مشرف عام",
          profileLocked: false,
          permissionKeys: ["MANAGE_USERS", "SETTINGS"],
        },
      });
      return c.json({
        success: true,
        message: "تم إنشاء/تحديث حساب المشرف.",
        user: admin.employeeCode,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  root.route("/api", api);
}
