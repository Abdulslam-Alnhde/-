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
    <header className="sticky top-0 z-20 flex h-[60px] shrink-0 items-center justify-between border-b border-[#EEEEEE] bg-white px-4 shadow-sm sm:px-6 dark:bg-[#162422] dark:border-[#1E3330] dark:text-[#CCCCCC]">
      {/* Mobile hamburger — right side in RTL (start side) */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden min-w-0 flex-1 lg:block" aria-hidden="true" />

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href={mailHref}
          className={`relative rounded-xl p-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40 ${
            onMailPage
              ? "bg-brand-teal/10 text-brand-teal"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          aria-label="صندوق الوارد والتنبيهات"
          title="صندوق الوارد"
        >
          <Bell className="h-[18px] w-[18px]" />
          {!onMailPage ? (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full border border-white bg-brand-orange" />
          ) : null}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2.5 rounded-xl px-2 hover:bg-muted"
            >
              <Avatar className="h-8 w-8 border-2 border-border">
                <AvatarImage src="" alt="" />
                <AvatarFallback className="bg-brand-teal/10 text-xs font-semibold text-brand-teal">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[130px] truncate text-sm font-medium text-foreground sm:inline">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 text-right">
                <p className="text-sm font-semibold leading-none">{userName}</p>
                {userEmail ? (
                  <p
                    className="text-xs leading-none text-muted-foreground"
                    dir="ltr"
                  >
                    {userEmail}
                  </p>
                ) : null}
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
              className="cursor-pointer justify-end gap-2 text-xs font-medium text-destructive focus:bg-destructive/10"
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
