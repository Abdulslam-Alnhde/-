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
} from "lucide-react";
import { AlarabLogo } from "@/common/components/brand/AlarabLogo";
import { cn } from "@/common/lib/utils";
import { ADMIN_LINKS, COMMITTEE_LINKS, TEACHER_LINKS } from "@/common/lib/dashboard-links";

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
  onClose,
}: {
  currentRole?: "TEACHER" | "COMMITTEE" | "ADMIN";
  userName?: string;
  userInitials?: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const menuRole = currentRole;
  const menuItems = routes[menuRole];

  return (
    <aside
      className="flex h-full min-h-0 w-[260px] shrink-0 flex-col shadow-xl"
      style={{ background: "var(--sidebar-gradient)" }}
    >
      {/* Logo / Brand */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 p-1 ring-1 ring-white/20">
            <AlarabLogo
              variant="inline"
              size="sm"
              className="[&_img]:h-auto [&_img]:max-h-[40px] [&_img]:w-auto [&_img]:brightness-0 [&_img]:invert"
            />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <span className="block truncate text-sm font-semibold tracking-tight text-white">
              جامعة العرب
            </span>
          </div>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-5">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#00A99D] text-white shadow-sm shadow-black/20"
                  : "text-white/60 hover:bg-[rgba(0,169,157,0.2)] hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-white" : "text-white/50"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/8 p-3 ring-1 ring-white/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00A99D] text-xs font-semibold text-white shadow-sm">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <span className="block truncate text-sm font-medium text-white">
              {userName}
            </span>
            <span className="text-[10px] text-white/50">
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
