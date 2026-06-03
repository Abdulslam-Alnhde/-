"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Inbox,
  Headphones,
  X,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { AlarabLogo } from "@/common/components/brand/AlarabLogo";
import { cn } from "@/common/lib/utils";
import {
  ADMIN_LINKS,
  COMMITTEE_LINKS,
  TEACHER_LINKS,
} from "@/common/lib/dashboard-links";

type Role = "TEACHER" | "COMMITTEE" | "ADMIN";

const routes: Record<
  Role,
  { label: string; icon: typeof LayoutDashboard; href: string }[]
> = {
  TEACHER: [
    { label: "لوحة التحكم", icon: LayoutDashboard, href: TEACHER_LINKS.dashboard },
    { label: "المستودع", icon: FileText, href: TEACHER_LINKS.exams },
    { label: "صندوق الوارد", icon: Inbox, href: TEACHER_LINKS.inbox },
    { label: "الإعدادات", icon: Settings, href: TEACHER_LINKS.settings },
  ],
  COMMITTEE: [
    { label: "الإحصائيات", icon: LayoutDashboard, href: COMMITTEE_LINKS.stats },
    { label: "قائمة المراجعة", icon: FileText, href: COMMITTEE_LINKS.queue },
    { label: "الإعدادات", icon: Settings, href: COMMITTEE_LINKS.settings },
  ],
  ADMIN: [
    { label: "نظرة عامة", icon: LayoutDashboard, href: ADMIN_LINKS.overview },
    { label: "دليل المستخدمين", icon: Users, href: ADMIN_LINKS.users },
    { label: "الدعم الفني", icon: Headphones, href: ADMIN_LINKS.support },
    { label: "الإعدادات", icon: Settings, href: ADMIN_LINKS.settings },
  ],
};

const ROLE_META: Record<
  Role,
  { label: string; icon: typeof ShieldCheck }
> = {
  TEACHER: { label: "أستاذ مقرّر", icon: GraduationCap },
  COMMITTEE: { label: "لجنة مراجعة", icon: ShieldCheck },
  ADMIN: { label: "مدير نظام", icon: ShieldCheck },
};

export function Sidebar({
  currentRole = "TEACHER",
  userName = "مستخدم النظام",
  userInitials = "؟",
  onClose,
}: {
  currentRole?: Role;
  userName?: string;
  userInitials?: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const menuItems = routes[currentRole];
  const roleMeta = ROLE_META[currentRole];
  const RoleIcon = roleMeta.icon;

  return (
    <aside
      className="relative flex h-full min-h-0 w-[270px] shrink-0 flex-col overflow-hidden border-l border-brand-teal/15 bg-white shadow-sm"
    >
      {/* subtle decorative tint */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(circle at 100% 0%, rgba(0,169,157,0.06) 0%, transparent 45%),
            radial-gradient(circle at 0% 100%, rgba(242,101,34,0.04) 0%, transparent 50%)`,
        }}
      />

      {/* ===== Brand header ===== */}
      <div className="relative flex shrink-0 items-center justify-between border-b border-border/80 bg-gradient-to-l from-brand-teal-light/40 to-transparent px-5 py-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-brand-teal-dark p-1 shadow-md shadow-brand-teal/30">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white">
              <AlarabLogo
                variant="inline"
                size="sm"
                className="[&_img]:h-auto [&_img]:max-h-[36px] [&_img]:w-auto"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1 text-right leading-tight">
            <span className="block truncate text-sm font-bold text-brand-teal-dark">
              جامعة العرب
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-orange">
              Exams Platform
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-brand-teal-light hover:text-brand-teal-dark lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ===== Section label ===== */}
      <div className="relative px-5 pt-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          القائمة
        </p>
      </div>

      {/* ===== Navigation ===== */}
      <nav className="relative min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-5">
        {menuItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== COMMITTEE_LINKS.stats &&
              item.href !== TEACHER_LINKS.dashboard &&
              item.href !== ADMIN_LINKS.overview &&
              pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={`${currentRole}-${item.label}-${item.href}`}
              href={item.href}
              onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-150",
                active
                  ? "bg-gradient-to-l from-brand-teal to-brand-teal-dark text-white shadow-lg shadow-brand-teal/30"
                  : "text-foreground/70 hover:bg-brand-teal-light hover:text-brand-teal-dark"
              )}
            >
              {/* active indicator bar */}
              {active && (
                <span className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 -translate-x-2 rounded-l-full bg-white/90 shadow-sm shadow-brand-teal/30" />
              )}
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition",
                  active
                    ? "text-white"
                    : "text-muted-foreground group-hover:text-brand-teal"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ===== User footer ===== */}
      <div className="relative shrink-0 border-t border-border/80 p-3">
        <div className="flex items-center gap-3 rounded-2xl border border-brand-teal/15 bg-gradient-to-l from-brand-teal-light/40 to-card p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-teal to-brand-teal-dark text-xs font-black text-white shadow-md shadow-brand-teal/30">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <span className="block truncate text-sm font-bold text-foreground">
              {userName}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-teal-light px-2 py-0.5 text-[10px] font-bold text-brand-teal-dark ring-1 ring-brand-teal/20">
              <RoleIcon className="h-2.5 w-2.5" />
              {roleMeta.label}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
