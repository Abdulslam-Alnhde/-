"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { Navbar } from "@/components/shared/Navbar";
import { displayInitials } from "@/lib/demo-users";

type Role = "TEACHER" | "COMMITTEE" | "ADMIN";

type Me = { name: string; email: string; role: Role };

function parseRole(r: unknown): Role | null {
  if (r === "ADMIN" || r === "COMMITTEE" || r === "TEACHER") return r;
  return null;
}

export function DashboardShell({
  currentRole,
  children,
}: {
  currentRole: Role;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(() => {
    const ac = new AbortController();
    fetch("/api/users/me", { cache: "no-store", signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error || !data?.id) {
          setMe(null);
          return;
        }
        const role = parseRole(data.role) ?? "TEACHER";
        setMe({
          name: data.name ?? "مستخدم",
          email: data.email ?? "",
          role,
        });
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setMe(null);
      });
    return () => ac.abort();
  }, []);

  /** مرة عند التحميل لكل تبويب — بدون إعادة توجيه أو مزامنة دور بين التبويبات */
  useEffect(() => {
    return loadMe();
  }, [loadMe]);

  const name = me?.name ?? "مستخدم النظام";
  const email = me?.email ?? "";
  const initials = displayInitials(name);

  return (
    <div className="flex h-screen max-h-[100dvh] min-h-0 flex-row overflow-hidden bg-slate-100/95 text-sm dark:bg-zinc-950">
      <Sidebar currentRole={currentRole} userName={name} userInitials={initials} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          currentRole={currentRole}
          userName={name}
          userEmail={email}
          userInitials={initials}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-[1400px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
