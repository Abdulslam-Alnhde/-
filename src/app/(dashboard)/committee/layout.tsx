import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * صفحات اللجنة مخصصة لدور COMMITTEE فقط.
 */
export default async function CommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role === "ADMIN") redirect("/admin");
  if (role === "TEACHER") redirect("/teacher");
  return <>{children}</>;
}
