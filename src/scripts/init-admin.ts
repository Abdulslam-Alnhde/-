import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminId = "1001"; // الرقم الوظيفي الذي ستستخدمه للدخول
  const password = "Admin@2026";
  const email = "admin@alarab.edu";
  
  console.log("🚀 جاري إنشاء حساب المشرف...");

  const passwordHash = bcrypt.hashSync(password, 12);

  // البحث عن كلية لإسنادها للمشرف
  const college = await prisma.college.findFirst();
  if (!college) {
    console.error("❌ خطأ: لم يتم العثور على أي كلية في النظام. يرجى تشغيل الـ seed أولاً.");
    return;
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
      email: email,
      role: "ADMIN",
      passwordHash,
      collegeId: college.id,
      department: "إدارة النظام",
      jobTitle: "مشرف عام",
      profileLocked: false,
      permissionKeys: ["MANAGE_USERS", "SETTINGS"],
    },
  });

  console.log("✅ تم إنشاء/تحديث حساب المشرف بنجاح!");
  console.log(`   الرقم الوظيفي: ${admin.employeeCode}`);
  console.log(`   كلمة المرور: ${password}`);
}

main()
  .catch((e) => {
    console.error("❌ خطأ أثناء الإنشاء:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
