"use client";

import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlarabLogo } from "@/components/brand/AlarabLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(
          "الرقم الوظيفي أو كلمة المرور غير صحيحة."
        );
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
    <div className="flex min-h-screen flex-col bg-[#f4f7f8] dark:bg-teal-950">
      {/* نموذج الدخول */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6">
              <AlarabLogo size="lg" priority />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              تسجيل الدخول
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-zinc-400">
              أدخل الرقم الوظيفي وكلمة المرور
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-right text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                الرقم الوظيفي
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600/70 dark:text-teal-400/80" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-full border-2 border-slate-200 bg-white py-3.5 pl-4 pr-11 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
                  placeholder="20230001"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-right text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600/70 dark:text-teal-400/80" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full border-2 border-slate-200 bg-white py-3.5 pl-4 pr-11 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-teal-400"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full bg-gradient-to-l from-teal-600 to-teal-700 text-base font-black text-white shadow-lg shadow-teal-600/25 transition hover:from-teal-500 hover:to-teal-600 hover:shadow-orange-500/10 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "دخول"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500 dark:text-zinc-500">
            <Link
              href="/"
              className="font-bold text-teal-600 hover:underline dark:text-teal-400"
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
        <div className="flex min-h-screen items-center justify-center bg-[#f4f7f8] dark:bg-teal-950">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
