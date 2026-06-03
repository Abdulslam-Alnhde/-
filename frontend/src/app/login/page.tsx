"use client";

import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/common/ui/button";
import Link from "next/link";
import { AlarabLogo } from "@/common/components/brand/AlarabLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen flex-col bg-[#F5F7F7] lg:flex-row-reverse">
      {/* ====== Brand panel (right in RTL) — LIGHT THEME ====== */}
      <aside className="relative hidden flex-1 overflow-hidden border-l border-brand-teal/15 bg-gradient-to-bl from-brand-teal-light/60 via-white to-brand-orange/5 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* soft decorative blobs */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-teal/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-brand-orange/12 blur-3xl"
          aria-hidden
        />

        {/* Top: brand */}
        <div className="relative">
          <Link href="/" className="group inline-flex items-center gap-5">
            <div className="rounded-3xl bg-gradient-to-br from-brand-teal to-brand-teal-dark p-1.5 shadow-lg shadow-brand-teal/30 transition group-hover:scale-105">
              <div className="rounded-[20px] bg-white p-3">
                <AlarabLogo
                  size="sm"
                  priority
                  className="[&_img]:max-h-20 sm:[&_img]:max-h-24"
                />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-black text-brand-teal-dark">جامعة العرب</span>
              <span className="text-xs font-black uppercase tracking-[0.28em] text-brand-orange">
                Exams Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Middle: tagline + bullets */}
        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-teal-dark shadow-sm ring-1 ring-brand-teal/20">
            <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
            بوابة الاختبارات الذكية
          </span>
          <h2
            className="mt-5 text-3xl font-black leading-[1.2] xl:text-4xl"
            style={{ color: "#1A2E2D" }}
          >
            ادخل وباشر
            <br />
            <span className="bg-gradient-to-l from-brand-orange via-[#F58A4D] to-brand-teal bg-clip-text text-transparent">
              تصحيحًا أسرع وأدقّ
            </span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            منصّة موحّدة للأستاذ واللجنة والإدارة — مسار واضح من إنشاء الاختبار
            وحتى تسليم الدرجات.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              "تصحيح بالذكاء الاصطناعي بدقة عالية",
              "مراجعة موحّدة لجان واعتماد",
              "تقارير ودرجات فورية قابلة للتصدير",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 font-medium text-foreground/85">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white shadow-sm shadow-brand-teal/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <p className="relative text-xs font-medium text-muted-foreground/80">
          © {new Date().getFullYear()} جامعة العرب
        </p>
      </aside>

      {/* ====== Form panel (left in RTL) ====== */}
      <main className="relative flex flex-1 items-center justify-center bg-white px-4 py-10 sm:px-8 lg:py-12">
        {/* mobile top header */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between border-b border-brand-teal/15 bg-gradient-to-l from-brand-teal-light/60 to-white px-4 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-dark p-0.5">
              <div className="rounded-md bg-white p-1">
                <AlarabLogo size="sm" />
              </div>
            </div>
            <span className="text-sm font-bold text-brand-teal-dark">جامعة العرب</span>
          </Link>
        </div>

        <div className="mt-12 w-full max-w-[440px] lg:mt-0">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-xl shadow-brand-teal/10 sm:p-10">
            <div className="mb-8 text-right">
              <span className="inline-block rounded-full bg-brand-teal-light px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-teal-dark">
                تسجيل دخول
              </span>
              <h1
                className="mt-3 text-2xl font-black tracking-tight md:text-3xl"
                style={{ color: "#1A2E2D" }}
              >
                مرحبًا بعودتك
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                ادخل بياناتك الجامعية للوصول إلى لوحتك.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#D32F2F]/30 bg-[#FFEBEB] px-4 py-3 text-sm font-semibold text-[#D32F2F]">
                <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#D32F2F]" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-teal/70" />
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-2xl border-2 border-border bg-white py-3.5 pl-4 pr-12 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-brand-teal focus:bg-brand-teal-light/30 focus:ring-4 focus:ring-brand-teal/15"
                    placeholder="name@university.edu"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-teal/70" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border-2 border-border bg-white py-3.5 pl-12 pr-12 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-brand-teal focus:bg-brand-teal-light/30 focus:ring-4 focus:ring-brand-teal/15"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-brand-teal/70 transition hover:bg-brand-teal-light hover:text-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="group h-[52px] w-full rounded-2xl bg-brand-orange text-base font-black text-white shadow-lg shadow-brand-orange/30 transition hover:bg-brand-orange-dark hover:shadow-xl disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    دخول
                    <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              <Link
                href="/"
                className="font-bold text-brand-teal hover:text-brand-teal-dark transition-colors"
              >
                ← العودة للصفحة الرئيسية
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            بدخولك توافق على سياسة الاستخدام الخاصة بمنصّة جامعة العرب.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7F7]">
          <Loader2 className="h-10 w-10 animate-spin text-brand-teal" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
