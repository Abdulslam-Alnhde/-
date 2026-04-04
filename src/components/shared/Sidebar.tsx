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
} from "lucide-react";
import { AlarabLogo } from "@/components/brand/AlarabLogo";
import { cn } from "@/lib/utils";
import { ADMIN_LINKS, COMMITTEE_LINKS, TEACHER_LINKS } from "@/lib/dashboard-links";

const routes = {
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

export function Sidebar({
  currentRole = "TEACHER",
  userName = "مستخدم النظام",
  userInitials = "؟",
}: {
  currentRole?: "TEACHER" | "COMMITTEE" | "ADMIN";
  userName?: string;
  userInitials?: string;
}) {
  const pathname = usePathname();
  /** القائمة ووسم الدور يتبعان بوابة الصفحة الحالية (/teacher vs /committee vs /admin) — تبويبات مختلفة تعرض واجهات مختلفة */
  const menuRole = currentRole;
  const menuItems = routes[menuRole];

  return (
    <aside className="flex h-full min-h-0 w-[260px] shrink-0 flex-col border-e border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-zinc-800">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-teal-200/80 bg-white p-1 shadow-sm dark:border-teal-800/50 dark:bg-zinc-900">
          <AlarabLogo
            variant="inline"
            size="sm"
            className="[&_img]:h-auto [&_img]:max-h-[44px] [&_img]:w-auto"
          />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <span className="block truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
            جامعة العرب
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500">
            منصة الاختبارات الإلكترونية
          </span>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-bold text-slate-500 dark:text-zinc-500">
          القائمة الرئيسية
        </p>
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-150",
                active
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/25 dark:bg-teal-600"
                  : "text-slate-600 hover:bg-teal-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-white" : "text-teal-600 dark:text-teal-400"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-100 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50/80 p-3 dark:bg-zinc-900/80">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
              {userName}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              {menuRole === "ADMIN"
                ? "مدير نظام"
                : menuRole === "COMMITTEE"
                  ? "لجنة مراجعة"
                  : "أستاذ مقرر"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
