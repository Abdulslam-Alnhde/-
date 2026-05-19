import Link from "next/link";
import {
  LogIn,
  GraduationCap,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  ScanLine,
  Brain,
  FileSpreadsheet,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import { AlarabLogo } from "@/common/components/brand/AlarabLogo";

const ROLES = [
  {
    icon: GraduationCap,
    title: "أعضاء هيئة التدريس",
    desc: "إنشاء الاختبارات، رفع أوراق الطلاب، واستلام نتائج التصحيح خلال دقائق.",
    accent: "teal" as const,
  },
  {
    icon: ClipboardCheck,
    title: "لجان المراجعة",
    desc: "مراجعة وتدقيق الاختبارات قبل اعتمادها، مع آلية واضحة للملاحظات.",
    accent: "orange" as const,
  },
  {
    icon: ShieldCheck,
    title: "إدارة الجامعة",
    desc: "إدارة المستخدمين والصلاحيات والإعدادات العامة للمنصة وتقارير شاملة.",
    accent: "teal" as const,
  },
];

const FEATURES = [
  {
    icon: ScanLine,
    title: "استخراج تلقائي بالـ OCR",
    desc: "قراءة دقيقة للأوراق الممسوحة ضوئيًا والتعرّف على الإجابات.",
  },
  {
    icon: Brain,
    title: "تصحيح بالذكاء الاصطناعي",
    desc: "تقييم عادل ومتسق للإجابات النصية والكودية مع شرح للدرجات.",
  },
  {
    icon: FileSpreadsheet,
    title: "تقارير ودرجات فورية",
    desc: "نتائج جاهزة للتصدير وإحصاءات تساعد على تطوير المقررات.",
  },
  {
    icon: Sparkles,
    title: "مسار اعتماد موحّد",
    desc: "من الإنشاء إلى المراجعة إلى التسليم — كل شيء في مكان واحد.",
  },
];

const STATS = [
  { v: "+95%", l: "دقّة التصحيح" },
  { v: "5×", l: "أسرع من اليدوي" },
  { v: "3", l: "أدوار متكاملة" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F7F7] text-foreground antialiased">
      {/* ============== TOP NAV ============== */}
      <header className="sticky top-0 z-30 border-b border-brand-teal/15 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-brand-teal to-brand-teal-dark p-1 shadow-sm shadow-brand-teal/30">
              <div className="rounded-[10px] bg-white p-1">
                <AlarabLogo size="sm" priority />
              </div>
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-bold text-brand-teal-dark">جامعة العرب</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange">
                Exams Platform
              </span>
            </div>
          </div>

          <Button
            asChild
            className="h-10 rounded-full bg-brand-orange px-5 text-sm font-bold text-white shadow-md shadow-brand-orange/30 transition hover:bg-brand-orange-dark"
          >
            <Link href="/login" prefetch={false} className="gap-2">
              <LogIn className="h-4 w-4" />
              تسجيل الدخول
            </Link>
          </Button>
        </div>
      </header>

      {/* ============== HERO (light) ============== */}
      <section className="relative overflow-hidden">
        {/* soft mesh background */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 85% 20%, rgba(0,169,157,0.18) 0%, transparent 45%),
              radial-gradient(circle at 15% 80%, rgba(242,101,34,0.12) 0%, transparent 45%),
              radial-gradient(circle at 50% 100%, rgba(0,169,157,0.08) 0%, transparent 50%)`,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-brand-teal/40 to-transparent" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          {/* RIGHT in RTL: text */}
          <div className="animate-fade-in text-right">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-teal-dark shadow-sm ring-1 ring-brand-teal/20">
              <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
              منصّة جامعية موحّدة
            </span>

            <h1
              className="mt-6 text-4xl font-black leading-[1.2] tracking-tight md:text-5xl lg:text-[3.4rem]"
              style={{ color: "#1A2E2D" }}
            >
              تصحيح الاختبارات بذكاء
              <br />
              <span className="bg-gradient-to-l from-brand-orange via-[#F58A4D] to-brand-teal bg-clip-text text-transparent">
                اصطناعي يفهم سياق إجابتك
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              نظام متكامل لإنشاء الاختبارات، مراجعتها من قبل اللجان، وتصحيحها تلقائيًا
              بدقة عالية. اختصر ساعات التصحيح اليدوي وركّز على ما يهم — تطوير الطالب.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="group h-14 rounded-full bg-brand-orange px-9 text-base font-black text-white shadow-xl shadow-brand-orange/30 transition hover:bg-brand-orange-dark"
              >
                <Link href="/login" prefetch={false} className="gap-2">
                  <LogIn className="h-5 w-5" />
                  ابدأ الآن
                  <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-1" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 rounded-full border-2 border-brand-teal/40 bg-white px-9 text-base font-bold text-brand-teal-dark hover:border-brand-teal hover:bg-brand-teal-light"
              >
                <Link href="#features">المزيد عن المنصة</Link>
              </Button>
            </div>
          </div>

          {/* LEFT in RTL: logo + stats */}
          <div className="flex flex-col items-center gap-8">
            <div className="relative">
              <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-brand-orange/20 via-transparent to-brand-teal/25 blur-3xl" />
              <div className="relative rounded-3xl border border-brand-teal/20 bg-white p-6 shadow-2xl shadow-brand-teal/15 sm:p-8">
                <AlarabLogo size="lg" priority />
              </div>
            </div>

            {/* stats — light cards */}
            <div className="grid w-full max-w-md grid-cols-3 gap-3">
              {STATS.map((s) => (
                <div
                  key={s.l}
                  className="rounded-2xl border border-brand-teal/20 bg-white p-4 text-center shadow-sm"
                >
                  <p className="text-2xl font-black text-brand-orange md:text-3xl">
                    {s.v}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============== ROLES ============== */}
      <section className="relative bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-teal-light px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-teal-dark">
              من يستخدم المنصة
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl" style={{ color: "#1A2E2D" }}>
              ثلاثة أدوار. <span className="text-brand-teal">مسار واحد سلس.</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              كل دور يحصل على واجهة مخصّصة وأدوات تركّز على مهامّه فقط، بدون تشتيت.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {ROLES.map((role) => {
              const isOrange = role.accent === "orange";
              return (
                <div
                  key={role.title}
                  className="group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-teal/40 hover:shadow-xl"
                >
                  <div
                    className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl transition-opacity duration-300 ${
                      isOrange ? "bg-brand-orange/15" : "bg-brand-teal/15"
                    } opacity-50 group-hover:opacity-100`}
                  />

                  <div
                    className={`relative inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ${
                      isOrange
                        ? "bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white shadow-brand-orange/30"
                        : "bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white shadow-brand-teal/30"
                    }`}
                  >
                    <role.icon className="h-7 w-7" />
                  </div>

                  <h3 className="relative mt-5 text-xl font-bold" style={{ color: "#1A2E2D" }}>
                    {role.title}
                  </h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                    {role.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="relative bg-[#F5F7F7] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-orange/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange-dark">
              المميزات
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl" style={{ color: "#1A2E2D" }}>
              ذكاء اصطناعي يخدم <span className="text-brand-orange">الأكاديميا</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              من رفع الورقة إلى تسليم الدرجة — كل خطوة مؤتمتة وقابلة للمراجعة.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="relative rounded-2xl border-2 border-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-teal/40 hover:shadow-md"
              >
                <div className="absolute -top-4 right-6 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white shadow-md shadow-brand-teal/30">
                  <span className="text-xs font-black tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <f.icon className="h-7 w-7 text-brand-teal" />
                <h3 className="mt-4 text-base font-bold" style={{ color: "#1A2E2D" }}>
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== CTA STRIP (light) ============== */}
      <section className="relative overflow-hidden bg-white py-16">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 80% 50%, rgba(242,101,34,0.12) 0%, transparent 40%),
              radial-gradient(circle at 20% 50%, rgba(0,169,157,0.18) 0%, transparent 40%)`,
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border-2 border-brand-teal/20 bg-gradient-to-bl from-brand-teal-light/60 via-white to-brand-orange/5 p-10 text-center shadow-md">
            <h2 className="text-2xl font-black md:text-4xl" style={{ color: "#1A2E2D" }}>
              جاهز لتختبر التصحيح الذكي؟
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              سجّل الدخول بحسابك الجامعي وابدأ خلال دقائق.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-14 rounded-full bg-brand-orange px-12 text-base font-black text-white shadow-xl shadow-brand-orange/30 hover:bg-brand-orange-dark"
            >
              <Link href="/login" prefetch={false} className="gap-2">
                <LogIn className="h-5 w-5" />
                تسجيل الدخول
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============== FOOTER (light) ============== */}
      <footer className="border-t border-brand-teal/15 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-brand-teal to-brand-teal-dark p-1 shadow-sm shadow-brand-teal/30">
              <div className="rounded-[10px] bg-white p-1">
                <AlarabLogo size="sm" />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-brand-teal-dark">جامعة العرب</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange">
                Exams Platform
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} جامعة العرب — جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>
    </div>
  );
}
