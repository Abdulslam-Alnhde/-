import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * مسارات المعلم لا تُعرض لغير دور TEACHER (حتى لو تعطّل الـ middleware).
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role === "COMMITTEE") redirect("/committee/queue");
  if (role === "ADMIN") redirect("/admin");
  return <>{children}</>;
}
