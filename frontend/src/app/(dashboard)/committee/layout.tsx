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
  // Admin is allowed to access Committee pages
  if (role === "TEACHER") redirect("/teacher");
  return <>{children}</>;
}
