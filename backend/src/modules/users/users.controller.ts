/** Users controller — HTTP layer for /users and /users/me. */
import type { Context } from "hono";
import type { Role } from "@prisma/client";
import { requireRoles } from "@/common/guards";
import { actingSubject } from "@/common/types";
import { forbidden, jsonError } from "@/common/http";
import { canAdminPanelAction } from "@/lib/admin-user-actions";
import {
  ALL_PERMISSION_KEYS,
  COMMITTEE_PERMISSION_KEYS,
  sanitizeKeysForRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  createUser,
  deleteUser,
  getUserById,
  getUserWithCollege,
  listUsers,
  updateUserAdmin,
  updateUserProfileUnlocked,
} from "./users.service";

export async function getMe(c: Context) {
  const actor = c.get("actor");
  try {
    const user = await getUserWithCollege(actor.userId);
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
      permissionKeys: user.role === "ADMIN" ? [...ALL_PERMISSION_KEYS] : user.permissionKeys ?? [],
      profileLocked: user.profileLocked ?? true,
    });
  } catch {
    return jsonError(c, "تعذر جلب بيانات المستخدم", 500);
  }
}

export async function patchMe(c: Context) {
  const actor = c.get("actor");
  try {
    const user = await getUserById(actor.userId);
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
    const updated = await updateUserProfileUnlocked({
      userId: user.id,
      name: body?.name,
      phone: body?.phone,
      department: body?.department,
      jobTitle: body?.jobTitle,
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
}

export async function adminListUsers(c: Context) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "list")) return forbidden(c);
  try {
    const users = await listUsers();
    const safe = users.map(({ passwordHash: _, ...u }) => u);
    return c.json(safe);
  } catch {
    return jsonError(c, "تعذر جلب المستخدمين", 500);
  }
}

export async function adminCreateUser(c: Context) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "create")) return forbidden(c);

  try {
    const body = await c.req.json();
    const result = await createUser({
      name: body?.name,
      email: body?.email,
      role: body?.role,
      employeeCode: body?.employeeCode,
      collegeId: body?.collegeId,
      department: body?.department,
      jobTitle: body?.jobTitle,
      phone: body?.phone,
      permissionKeys: body?.permissionKeys,
      profileLocked: body?.profileLocked,
      password: body?.password,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json({ success: true, user: result.user });
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
}

export async function adminPatchUser(c: Context) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "edit")) return forbidden(c);

  const id = c.req.param("id");
  if (!id) return jsonError(c, "معرّف غير صالح", 400);
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
    } = body ?? {};

    const code = employeeCode !== undefined ? String(employeeCode).trim() : undefined;
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
    if (role === "TEACHER" || role === "COMMITTEE" || role === "ADMIN") data.role = role as Role;
    if (code !== undefined) data.employeeCode = code;
    if (collegeId !== undefined) data.collegeId = collegeId || null;
    if (department !== undefined) data.department = department || null;
    if (jobTitle !== undefined) data.jobTitle = jobTitle || null;
    if (phone !== undefined) data.phone = phone || null;
    if (nationalId !== undefined) data.nationalId = nationalId || null;
    if (hireDate !== undefined && hireDate !== null) data.hireDate = new Date(hireDate);

    const nextRole = (data.role as Role | undefined) ?? undefined;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return jsonError(c, "غير موجود", 404);
    const effectiveRole = (nextRole ?? existing.role) as Role;

    if (effectiveRole === "TEACHER") {
      data.permissionKeys = [];
    } else if (Array.isArray(permissionKeys)) {
      let nextKeys = sanitizeKeysForRole(effectiveRole, permissionKeys);
      if (effectiveRole === "ADMIN") nextKeys = [...ALL_PERMISSION_KEYS];
      if (effectiveRole === "COMMITTEE" && nextKeys.length === 0) nextKeys = [...COMMITTEE_PERMISSION_KEYS];
      data.permissionKeys = nextKeys;
    }

    if (typeof profileLocked === "boolean") data.profileLocked = profileLocked;
    if (typeof password === "string" && password.length > 0) {
      data.passwordHash = await hashPassword(password);
    }

    const user = await updateUserAdmin({ id, data: data as any });
    const { passwordHash: _, ...rest } = user;
    return c.json({ success: true, user: rest });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return jsonError(c, "البريد أو الرقم الوظيفي مستخدم مسبقاً", 400);
    }
    return jsonError(c, "تعذر تحديث المستخدم", 500);
  }
}

export async function adminDeleteUser(c: Context) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "delete")) return forbidden(c);

  const id = c.req.param("id");
  if (!id) return jsonError(c, "معرّف غير صالح", 400);
  if (id === actor.userId) return jsonError(c, "لا يمكنك حذف حسابك", 400);

  try {
    await deleteUser(id);
    return c.json({ success: true });
  } catch {
    return jsonError(c, "تعذر حذف المستخدم", 500);
  }
}
