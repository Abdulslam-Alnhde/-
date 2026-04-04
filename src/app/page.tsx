"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 antialiased text-white dark:from-teal-950 dark:via-teal-900 dark:to-teal-950">
      <section className="relative flex min-h-screen flex-col landing-hero-chevron overflow-hidden pb-28 pt-12 md:pb-36 md:pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(234,88,12,0.2) 0%, transparent 42%),
              radial-gradient(circle at 75% 75%, rgba(45,212,191,0.15) 0%, transparent 40%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-orange-500/12 blur-2xl"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="animate-fade-in flex flex-col items-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-teal-200/90">
              منصة أكاديمية موحّدة
            </p>
            <h1 className="text-3xl font-black leading-[1.15] tracking-tight md:text-5xl lg:text-6xl">
              إدارة الاختبارات
              <span className="mt-2 block bg-gradient-to-l from-white via-teal-100 to-orange-200/90 bg-clip-text text-transparent">
                بكفاءة وبساطة
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-teal-100/95 md:text-lg">
              نظام متكامل لإنشاء الاختبارات ومراجعة اللجان وتصحيح الأوراق — مسار واحد واضح
              يخدم الأستاذ واللجنة والإدارة.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full border-0 bg-gradient-to-l from-orange-500 to-orange-600 px-10 text-base font-black text-white shadow-lg shadow-orange-900/25 hover:from-orange-400 hover:to-orange-500 md:h-14 md:px-12"
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
