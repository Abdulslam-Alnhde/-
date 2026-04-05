import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen antialiased text-white" style={{ background: "#003D38" }}>
      <section className="relative flex min-h-screen flex-col landing-hero-chevron overflow-hidden pb-28 pt-12 md:pb-36 md:pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(0,169,157,0.4) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(0,58,52,0.6) 0%, transparent 50%)`,
          }}
        />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="animate-fade-in flex flex-col items-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-white/60">
              منصة أكاديمية موحّدة
            </p>
            <h1 className="text-3xl font-black leading-[1.15] tracking-tight md:text-5xl lg:text-6xl">
              إدارة الاختبارات
              <span className="mt-2 block text-white">
                بكفاءة وبساطة
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/70 md:text-lg">
              نظام متكامل لإنشاء الاختبارات ومراجعة اللجان وتصحيح الأوراق — مسار واحد واضح
              يخدم الأستاذ واللجنة والإدارة.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full border-0 px-10 text-base font-black text-white shadow-lg shadow-black/25 md:h-14 md:px-12"
                style={{ background: "#F26522" }}
              >
                <Link href="/login" prefetch={false} className="gap-2">
                  <LogIn className="h-5 w-5" />
                  ابدأ الآن
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
