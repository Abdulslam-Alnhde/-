import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const user = await prisma.user.findUnique({
      where: { id: auth.session!.user.id },
      include: {
        college: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: "تعذر جلب بيانات المستخدم" },
      { status: 500 }
    );
  }
}

/** تحديث الملف الشخصي عندما يكون الحساب غير مقفل */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const user = await prisma.user.findUnique({
      where: { id: auth.session!.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (user.profileLocked) {
      return NextResponse.json(
        {
          error:
            "الحساب مقفل للتعديل المباشر. أرسل طلب تعديل من صفحة الإعدادات أو راجع المشرف.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, phone, department, jobTitle } = body;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(typeof name === "string" && { name: name.trim() }),
        ...(typeof phone === "string" && { phone: phone.trim() || null }),
        ...(typeof department === "string" && { department: department.trim() || null }),
        ...(typeof jobTitle === "string" && { jobTitle: jobTitle.trim() || null }),
      },
    });

    return NextResponse.json({
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
    return NextResponse.json(
      { error: "تعذر حفظ التعديلات" },
      { status: 500 }
    );
  }
}
