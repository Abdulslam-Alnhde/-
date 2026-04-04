import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * رابط سري لتهيئة حساب المشرف من داخل Vercel
 * سيتم حذفه بعد استخدامه
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // كلمة سرية مؤقتة للحماية
  if (secret !== "AlArab2026_Secure") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminId = "1001";
    const password = "Admin@2026";
    const passwordHash = bcrypt.hashSync(password, 12);

    // التأكد من وجود كليات (إذا كانت القاعدة فارغة)
    let college = await prisma.college.findFirst();
    if (!college) {
      college = await prisma.college.create({
        data: { name: "كلية علوم الحاسب والمعلومات", sortOrder: 0 }
      });
    }

    const admin = await prisma.user.upsert({
      where: { employeeCode: adminId },
      update: {
        passwordHash,
        role: "ADMIN",
      },
      create: {
        employeeCode: adminId,
        name: "مشرف النظام",
        email: "admin@university.edu",
        role: "ADMIN",
        passwordHash,
        collegeId: college.id,
        department: "إدارة النظام",
        jobTitle: "مشرف عام",
        profileLocked: false,
        permissionKeys: ["MANAGE_USERS", "SETTINGS"],
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم إنشاء حساب المشرف بنجاح!",
      user: admin.employeeCode 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
