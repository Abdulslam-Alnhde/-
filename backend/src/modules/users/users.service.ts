/** Users service — database operations for admin and self-profile endpoints. */
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  ALL_PERMISSION_KEYS,
  COMMITTEE_PERMISSION_KEYS,
  sanitizeKeysForRole,
} from "@/lib/permissions";

export async function getUserWithCollege(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { college: { select: { id: true, name: true } } },
  });
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function updateUserProfileUnlocked(params: {
  userId: string;
  name?: unknown;
  phone?: unknown;
  department?: unknown;
  jobTitle?: unknown;
}) {
  const { userId, name, phone, department, jobTitle } = params;
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(typeof name === "string" && { name: name.trim() }),
      ...(typeof phone === "string" && { phone: phone.trim() || null }),
      ...(typeof department === "string" && {
        department: department.trim() || null,
      }),
      ...(typeof jobTitle === "string" && { jobTitle: jobTitle.trim() || null }),
    },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { college: { select: { id: true, name: true } } },
  });
}

export async function createUser(params: {
  name: unknown;
  email: unknown;
  role: unknown;
  employeeCode: unknown;
  collegeId: unknown;
  department?: unknown;
  jobTitle?: unknown;
  phone?: unknown;
  permissionKeys?: unknown;
  profileLocked?: unknown;
  password: unknown;
}) {
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
  } = params;

  if (!name || !email || !role) {
    return { ok: false as const, status: 400, error: "الاسم والبريد والدور مطلوبة" };
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return {
      ok: false as const,
      status: 400,
      error: "كلمة مرور مطلوبة (6 أحرف على الأقل)",
    };
  }

  const code = typeof employeeCode === "string" ? employeeCode.trim() : "";
  if (!code) return { ok: false as const, status: 400, error: "الرقم الوظيفي مطلوب" };

  if (!collegeId || typeof collegeId !== "string") {
    return { ok: false as const, status: 400, error: "يجب اختيار الكلية" };
  }
  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) return { ok: false as const, status: 400, error: "الكلية غير صالحة" };

  const passwordHash = await hashPassword(password);
  const roleTyped = role as Role;
  const rawKeys = Array.isArray(permissionKeys) ? permissionKeys : [];
  let keys = sanitizeKeysForRole(roleTyped, rawKeys);
  if (roleTyped === "ADMIN") keys = [...ALL_PERMISSION_KEYS];
  if (roleTyped === "COMMITTEE" && keys.length === 0) keys = [...COMMITTEE_PERMISSION_KEYS];

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      role: roleTyped,
      passwordHash,
      employeeCode: code,
      collegeId,
      department: typeof department === "string" ? department.trim() || null : null,
      jobTitle: typeof jobTitle === "string" ? jobTitle.trim() || null : null,
      phone: typeof phone === "string" ? phone.trim() || null : null,
      permissionKeys: keys,
      profileLocked: typeof profileLocked === "boolean" ? profileLocked : true,
    },
    include: { college: { select: { id: true, name: true } } },
  });

  const { passwordHash: _, ...rest } = user;
  return { ok: true as const, status: 200, user: rest };
}

export async function updateUserAdmin(params: {
  id: string;
  data: any;
}) {
  return prisma.user.update({
    where: { id: params.id },
    data: params.data,
    include: { college: { select: { id: true, name: true } } },
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
