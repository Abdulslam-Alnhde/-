"use client";

import { DashboardShell } from "@/common/components/shared/DashboardShell";
import { AuthProvider } from "@/modules/auth/providers/auth-provider";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  let role: "TEACHER" | "COMMITTEE" | "ADMIN" = "TEACHER";
  if (pathname.startsWith("/committee")) role = "COMMITTEE";
  if (pathname.startsWith("/admin")) role = "ADMIN";

  return (
    <AuthProvider>
      <DashboardShell currentRole={role}>{children}</DashboardShell>
    </AuthProvider>
  );
}
