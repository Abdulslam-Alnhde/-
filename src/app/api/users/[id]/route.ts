import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { forbidden, requireRole } from "@/lib/auth-server";
import { hashPassword } from "@/lib/password";
import { canAdminPanelAction } from "@/lib/admin-user-actions";
import {
  COMMITTEE_PERMISSION_KEYS,
  PERMISSION_KEYS,
  sanitizeKeysForRole,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "edit")) {
      return forbidden();
    }

    if (params.id === gate.session!.user.id) {
      return NextResponse.json(
        { error: "لا يمكنك تعديل حسابك من هذه القائمة" },
        { status: 400 }
      );
    }

    const id = params.id;
    const body = await req.json();
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
      employeeCode !== undefined
        ? String(employeeCode).trim()
        : undefined;
    if (code !== undefined && !code) {
      return NextResponse.json(
        { error: "الرقم الوظيفي لا يمكن أن يكون فارغاً" },
        { status: 400 }
      );
    }

    if (collegeId !== undefined && collegeId !== null && collegeId !== "") {
      const col = await prisma.college.findUnique({
        where: { id: collegeId },
      });
      if (!col) {
        return NextResponse.json({ error: "الكلية غير صالحة" }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    if (typeof name === "string") data.name = name.trim();
    if (typeof email === "string") data.email = email.trim();
    if (role === "TEACHER" || role === "COMMITTEE" || role === "ADMIN")
      data.role = role as Role;
    if (code !== undefined) data.employeeCode = code;
    if (collegeId !== undefined) {
      data.collegeId = collegeId || null;
    }
    if (department !== undefined) data.department = department || null;
    if (jobTitle !== undefined) data.jobTitle = jobTitle || null;
    if (phone !== undefined) data.phone = phone || null;
    if (nationalId !== undefined) data.nationalId = nationalId || null;
    if (hireDate !== undefined && hireDate !== null)
      data.hireDate = new Date(hireDate);

    const nextRole = (data.role as Role | undefined) ?? undefined;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
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
      data: data as any,
      include: {
        college: { select: { id: true, name: true } },
      },
    });

    const { passwordHash: _, ...rest } = user;
    return NextResponse.json({ success: true, user: rest });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "البريد أو الرقم الوظيفي مستخدم مسبقاً" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "تعذر تحديث المستخدم" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "delete")) {
      return forbidden();
    }

    if (params.id === gate.session!.user.id) {
      return NextResponse.json(
        { error: "لا يمكنك حذف حسابك" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "تعذر حذف المستخدم" },
      { status: 500 }
    );
  }
}
