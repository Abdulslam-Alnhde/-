"use client";

import { DashboardShell } from "@/components/shared/DashboardShell";
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

  return <DashboardShell currentRole={role}>{children}</DashboardShell>;
}
