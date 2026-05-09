"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Bell, LogOut, User, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { useExamStore } from "@/store/useExamStore";
import { dashboardMailHref } from "@/lib/dashboard-links";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Navbar({
  currentRole = "TEACHER",
  userName = "مستخدم النظام",
  userEmail = "",
  userInitials = "؟",
}: {
  currentRole?: "TEACHER" | "COMMITTEE" | "ADMIN";
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const resetStore = useExamStore((state) => state.reset);
  const mailHref = dashboardMailHref(currentRole);
  const onMailPage =
    pathname === mailHref || pathname.startsWith(`${mailHref}?`);

  const handleLogout = async () => {
    resetStore();
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-teal-900/35 dark:bg-[hsl(var(--card))] sm:px-6">
      <div className="min-w-0 flex-1" aria-hidden="true" />

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href={mailHref}
          className={`relative rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 ${
            onMailPage
              ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
              : "text-slate-600 hover:bg-teal-50/80 hover:text-teal-700 dark:text-zinc-300 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
          }`}
          aria-label="صندوق الوارد والتنبيهات"
          title="صندوق الوارد"
        >
          <Bell className="h-5 w-5" />
          {!onMailPage ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-orange-500 dark:border-[hsl(var(--card))]" />
          ) : null}
        </Link>

        <button
          type="button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="تغيير المظهر"
        >
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-lg px-2 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <Avatar className="h-9 w-9 border border-slate-200 dark:border-zinc-700">
                <AvatarImage src="" alt="" />
                <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-bold text-slate-800 dark:text-zinc-100 sm:inline">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 text-right">
                <p className="text-sm font-bold leading-none">{userName}</p>
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
            <DropdownMenuItem className="cursor-pointer justify-end gap-2 text-xs font-semibold">
              <span>الملف الشخصي</span>
              <User className="h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer justify-end gap-2 text-xs font-semibold">
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
