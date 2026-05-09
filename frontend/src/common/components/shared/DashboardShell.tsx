"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/common/components/shared/Sidebar";
import { Navbar } from "@/common/components/shared/Navbar";
import { displayInitials } from "@/common/lib/demo-users";

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  useEffect(() => {
    return loadMe();
  }, [loadMe]);

  /* Close mobile sidebar on route change */
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, []);

  const name = me?.name ?? "مستخدم النظام";
  const email = me?.email ?? "";
  const initials = displayInitials(name);

  return (
    <div className="flex h-screen max-h-[100dvh] min-h-0 flex-row overflow-hidden bg-background text-sm">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — always visible on desktop, drawer on mobile */}
      <div
        className={`fixed inset-y-0 right-0 z-[70] transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <Sidebar
          currentRole={currentRole}
          userName={name}
          userInitials={initials}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          currentRole={currentRole}
          userName={name}
          userEmail={email}
          userInitials={initials}
          onMenuToggle={() => setMobileSidebarOpen((v) => !v)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
