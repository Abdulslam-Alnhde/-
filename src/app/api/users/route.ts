import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "list")) {
      return forbidden();
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        college: { select: { id: true, name: true } },
      },
    });
    const safe = users.map(({ passwordHash: _, ...u }) => u);
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: "تعذر جلب المستخدمين" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "create")) {
      return forbidden();
    }

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
      permissionKeys,
      profileLocked,
      password,
    } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "الاسم والبريد والدور مطلوبة" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "كلمة مرور مطلوبة (6 أحرف على الأقل)" },
        { status: 400 }
      );
    }

    const code =
      typeof employeeCode === "string" ? employeeCode.trim() : "";
    if (!code) {
      return NextResponse.json(
        { error: "الرقم الوظيفي مطلوب" },
        { status: 400 }
      );
    }

    if (!collegeId || typeof collegeId !== "string") {
      return NextResponse.json({ error: "يجب اختيار الكلية" }, { status: 400 });
    }

    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    });
    if (!college) {
      return NextResponse.json({ error: "الكلية غير صالحة" }, { status: 400 });
    }

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
        profileLocked:
          typeof profileLocked === "boolean" ? profileLocked : true,
      },
      include: {
        college: { select: { id: true, name: true } },
      },
    });

    const { passwordHash: _, ...rest } = user;
    return NextResponse.json({ success: true, user: rest });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        {
          error:
            "الرقم الوظيفي أو البريد الإلكتروني مسجل مسبقاً — تحقق من عدم تكرار المعرّف.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "فشل إنشاء المستخدم" }, { status: 500 });
  }
}
