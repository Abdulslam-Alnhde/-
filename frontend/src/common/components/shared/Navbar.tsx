"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, User, Settings, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { useExamStore } from "@/modules/exams/store/useExamStore";
import { dashboardMailHref } from "@/common/lib/dashboard-links";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/common/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/common/ui/avatar";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";

const ROLE_LABEL: Record<"TEACHER" | "COMMITTEE" | "ADMIN", string> = {
  TEACHER: "أستاذ مقرّر",
  COMMITTEE: "لجنة مراجعة",
  ADMIN: "مدير نظام",
};

export function Navbar({
  currentRole = "TEACHER",
  userName = "مستخدم النظام",
  userEmail = "",
  userInitials = "؟",
  onMenuToggle,
}: {
  currentRole?: "TEACHER" | "COMMITTEE" | "ADMIN";
  userName?: string;
  userEmail?: string;
  userInitials?: string;
  onMenuToggle?: () => void;
}) {
  const pathname = usePathname();
  const resetStore = useExamStore((state) => state.reset);
  const mailHref = dashboardMailHref(currentRole);
  const onMailPage =
    pathname === mailHref || pathname.startsWith(`${mailHref}?`);

  const handleLogout = async () => {
    resetStore();
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header className="sticky top-0 z-20 flex h-[64px] shrink-0 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile hamburger — right side in RTL */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-brand-teal-light hover:text-brand-teal-dark lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 flex-1 lg:block" aria-hidden="true" />

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Notifications */}
        <Link
          href={mailHref}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40",
            onMailPage
              ? "bg-brand-teal/10 text-brand-teal-dark"
              : "text-muted-foreground hover:bg-brand-teal-light hover:text-brand-teal-dark"
          )}
          aria-label="صندوق الوارد والتنبيهات"
          title="صندوق الوارد"
        >
          <Bell className="h-[18px] w-[18px]" />
          {!onMailPage && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-card bg-brand-teal" />
          )}
        </Link>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-11 gap-2.5 rounded-xl px-2 hover:bg-brand-teal-light"
            >
              <Avatar className="h-9 w-9 ring-2 ring-brand-teal/20">
                <AvatarImage src="" alt="" />
                <AvatarFallback className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-xs font-bold text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] flex-col items-start leading-tight sm:flex">
                <span className="truncate text-sm font-bold text-foreground">
                  {userName}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {ROLE_LABEL[currentRole]}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1 text-right">
                <p className="text-sm font-bold leading-none text-foreground">
                  {userName}
                </p>
                {userEmail && (
                  <p
                    className="truncate text-xs leading-none text-muted-foreground"
                    dir="ltr"
                  >
                    {userEmail}
                  </p>
                )}
                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-brand-teal-light px-2 py-0.5 text-[10px] font-bold text-brand-teal-dark">
                  {ROLE_LABEL[currentRole]}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer justify-end gap-2 text-xs font-medium">
              <span>الملف الشخصي</span>
              <User className="h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer justify-end gap-2 text-xs font-medium">
              <span>الإعدادات</span>
              <Settings className="h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer justify-end gap-2 text-xs font-bold text-destructive focus:bg-destructive/10"
              onClick={handleLogout}
            >
              <span>تسجيل الخروج</span>
              <LogOut className="h-4 w-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
