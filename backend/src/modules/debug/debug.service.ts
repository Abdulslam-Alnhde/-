import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function bootstrapAdminAccount(): Promise<
  | { ok: true; employeeCode: string }
  | { ok: false; error: string }
> {
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
  await prisma.user.upsert({
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
  return { ok: true, employeeCode: adminId };
}
