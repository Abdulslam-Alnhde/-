"use client";

import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlarabLogo } from "@/components/brand/AlarabLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("البريد أو كلمة المرور غير صحيحة.");
        return;
      }

      if (res?.ok === false && !res?.error) {
        setError("تعذر إكمال تسجيل الدخول. حاول مرة أخرى.");
        return;
      }

      router.refresh();

      let session = await getSession();
      for (let i = 0; i < 20; i++) {
        const role =
          session?.user && "role" in session.user
            ? (session.user as { role?: string }).role
            : undefined;
        if (role) break;
        await new Promise((r) => setTimeout(r, 80));
        session = await getSession();
      }

      const role =
        session?.user && "role" in session.user
          ? (session.user as { role?: string }).role
          : undefined;

      if (!role) {
        setError(
          "تم التحقق من البيانات لكن الجلسة لم تظهر بعد. سيتم إعادة تحميل الصفحة للمحاولة."
        );
        window.setTimeout(() => {
          window.location.reload();
        }, 800);
        return;
      }

      let target: string;
      if (callbackUrl && callbackUrl.startsWith("/")) {
        target = callbackUrl;
      } else {
        target =
          role === "ADMIN"
            ? "/admin"
            : role === "COMMITTEE"
              ? "/committee"
              : "/teacher";
      }

      window.location.assign(target);
    } catch {
      setError("حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-brand-teal-light dark:bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-[420px] rounded-2xl bg-card p-8 shadow-lg dark:shadow-black/30 sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6">
              <AlarabLogo size="lg" priority />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              تسجيل الدخول
            </h1>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-[#D32F2F]/30 bg-[#FFEBEB] px-4 py-3 text-sm font-bold text-[#D32F2F] dark:bg-[#2A1616] dark:border-[#D32F2F]/40 dark:text-[#EF5350]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-right text-xs font-medium text-muted-foreground">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-teal/70" />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-full border-2 border-border bg-card py-3.5 pl-4 pr-11 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/15"
                  placeholder="name@university.edu"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-right text-xs font-medium text-muted-foreground">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-teal/70" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full border-2 border-border bg-card py-3.5 pl-4 pr-11 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/15"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-brand-teal-dark disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "دخول"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link
              href="/"
              className="font-bold text-brand-teal hover:text-brand-teal-dark hover:underline transition-colors"
            >
              العودة للصفحة الرئيسية
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-teal-light">
          <Loader2 className="h-10 w-10 animate-spin text-brand-teal" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
