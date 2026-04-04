import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COLLEGES = [
  "كلية علوم الحاسب والمعلومات",
  "كلية الهندسة",
  "كلية العلوم الإدارية والمالية",
  "كلية التربية",
  "كلية العلوم الطبية التطبيقية",
  "كلية العلوم",
  "عمادة القبول والتسجيل",
  "عمادة التطوير والجودة",
];

/** كلمة مرور المشرف الأولية — يُفضّل تعيين ADMIN_INITIAL_PASSWORD في .env */
const adminPlainPassword =
  process.env.ADMIN_INITIAL_PASSWORD ||
  process.env.DEMO_USER_PASSWORD ||
  "Demo123!";

async function main() {
  console.log("🗑️  حذف جميع البيانات…");

  await prisma.$transaction([
    prisma.exam.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.profileChangeRequest.deleteMany(),
    prisma.user.deleteMany(),
    prisma.college.deleteMany(),
  ]);

  await prisma.college.createMany({
    data: COLLEGES.map((name, i) => ({ name, sortOrder: i })),
  });

  const firstCollege = await prisma.college.findFirst({
    orderBy: { sortOrder: "asc" },
  });

  if (!firstCollege) {
    throw new Error("تعذر إنشاء الكليات");
  }

  const passwordHash = bcrypt.hashSync(adminPlainPassword, 12);

  const adminEmail =
    (process.env.ADMIN_EMAIL || "admin@university.edu").trim().toLowerCase();

  const admin = await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME || "مشرف النظام",
      email: adminEmail,
      role: "ADMIN",
      passwordHash,
      employeeCode: process.env.ADMIN_EMPLOYEE_CODE || "A-0001",
      collegeId: firstCollege.id,
      department: process.env.ADMIN_DEPARTMENT || "إدارة النظام",
      jobTitle: process.env.ADMIN_JOB_TITLE || "مشرف النظام",
      phone: process.env.ADMIN_PHONE || null,
      profileLocked: false,
      permissionKeys: ["MANAGE_USERS"],
    },
  });

  console.log("✅ تمت إعادة التهيئة: كليات + مستخدم مشرف واحد.");
  console.log(`   البريد: ${admin.email}`);
  console.log(`   الكليات: ${COLLEGES.length}`);
  console.log(
    "   كلمة المرور: (من ADMIN_INITIAL_PASSWORD أو DEMO_USER_PASSWORD أو الافتراضي Demo123!)"
  );
  console.log(`   المعرّف: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error("❌ خطأ في الـ seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
