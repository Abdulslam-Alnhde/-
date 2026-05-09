"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle, Clock, FileText,
  BarChart3, Users, ExternalLink, ArrowUpRight, AlertCircle, Loader2, ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { COMMITTEE_LINKS } from "@/lib/dashboard-links";

type CommitteeStats = {
  pending: number;
  approved: number;
  rejected: number;
  totalReviewed: number;
};

const EMPTY_STATS: CommitteeStats = {
  pending: 0,
  approved: 0,
  rejected: 0,
  totalReviewed: 0,
};

function normalizeCommitteePayload(raw: unknown): {
  stats: CommitteeStats;
  recentActivity: any[];
  fetchError: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { stats: { ...EMPTY_STATS }, recentActivity: [], fetchError: null };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.error === "string") {
    return {
      stats: { ...EMPTY_STATS },
      recentActivity: [],
      fetchError: o.error,
    };
  }
  const s = o.stats;
  const stats =
    s && typeof s === "object"
      ? {
          pending: Number((s as Record<string, unknown>).pending) || 0,
          approved: Number((s as Record<string, unknown>).approved) || 0,
          rejected: Number((s as Record<string, unknown>).rejected) || 0,
          totalReviewed:
            Number((s as Record<string, unknown>).totalReviewed) || 0,
        }
      : { ...EMPTY_STATS };
  const recentActivity = Array.isArray(o.recentActivity)
    ? o.recentActivity
    : [];
  return { stats, recentActivity, fetchError: null };
}

export default function CommitteeDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPreview, setPendingPreview] = useState<any[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/exams/pending")
      .then((r) => r.json())
      .then((d) => setPendingPreview(Array.isArray(d) ? d.slice(0, 8) : []))
      .catch(() => setPendingPreview([]));
  }, []);

  useEffect(() => {
    fetch("/api/committee/stats")
      .then(async (res) => {
        const d = await res.json();
        const normalized = normalizeCommitteePayload(d);
        if (!res.ok) {
          setStatsError(
            typeof d?.error === "string" ? d.error : "تعذّر تحميل إحصائيات اللجنة."
          );
          setData({
            stats: normalized.stats,
            recentActivity: normalized.recentActivity,
          });
          return;
        }
        setStatsError(normalized.fetchError);
        setData({
          stats: normalized.stats,
          recentActivity: normalized.recentActivity,
        });
      })
      .catch(() => {
        setStatsError("تعذّر الاتصال بالخادم.");
        setData({
          stats: { ...EMPTY_STATS },
          recentActivity: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold tracking-widest">جارِ تحميل لوحة اللجنة…</p>
      </div>
    );
  }

  const { stats, recentActivity } = normalizeCommitteePayload(data);

  const cards: {
    label: string;
    val: number;
    icon: LucideIcon;
    color: string;
    bg: string;
    href: string;
  }[] = [
    {
      label: "طلبات معلقة",
      val: stats.pending,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      href: COMMITTEE_LINKS.queue,
    },
    {
      label: "تم اعتمادها",
      val: stats.approved,
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      href: COMMITTEE_LINKS.activity,
    },
    {
      label: "نماذج مرفوضة",
      val: stats.rejected,
      icon: AlertCircle,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-500/10",
      href: COMMITTEE_LINKS.queue,
    },
    {
      label: "إجمالي المراجعات",
      val: stats.totalReviewed,
      icon: BarChart3,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      href: COMMITTEE_LINKS.kpis,
    },
  ];

  return (
    <div className="space-y-8 h-full animate-fade-in">
      {statsError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {statsError}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            بوابة اللجنة — فقط المراجعة والاعتماد
          </p>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            لوحة اللجنة
          </h1>
          <p className="text-muted-foreground text-sm font-bold opacity-70">
            متابعة الطلبات المعلقة والاعتماد أو الرفض — دون إنشاء اختبارات جديدة.
          </p>
        </div>
        <Button asChild className="gap-3 h-12 px-6 rounded-2xl shadow-xl shadow-primary/20 bg-gradient-to-r from-blue-600 to-indigo-600 font-black">
          <Link href={COMMITTEE_LINKS.queue}>
            <FileText className="w-5 h-5" /> الذهاب لقائمة التصحيح
          </Link>
        </Button>
      </div>

      {pendingPreview.length > 0 && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-amber-950 dark:text-amber-100">
              طلبات بانتظار المراجعة الآن
            </h2>
            <Link
              href={COMMITTEE_LINKS.queue}
              className="inline-flex items-center gap-1 text-xs font-black text-indigo-700 hover:underline dark:text-indigo-300"
            >
              فتح قائمة المراجعة
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
          <ul className="space-y-2">
            {pendingPreview.map((ex) => (
              <li key={ex.id}>
                <Link
                  href={`/committee/queue?examId=${ex.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-sm font-bold shadow-sm transition hover:border-indigo-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-indigo-700"
                >
                  <span className="min-w-0 truncate text-slate-900 dark:text-white">
                    {ex.title}
                  </span>
                  <span className="shrink-0 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                    مراجعة وتصحيح ←
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div id="committee-kpis" className="scroll-mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-slate-200/90 bg-card p-6 shadow-sm transition-shadow hover:shadow-lg hover:shadow-slate-500/10 dark:border-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className={`p-4 rounded-2xl ${item.bg} ${item.color} shadow-inner`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[2px] mb-1 opacity-60">{item.label}</p>
                <h3 className="text-4xl font-black leading-none text-foreground">{item.val}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              <ArrowUpRight className="w-3 h-3" /> +12% من الدورة السابقة
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div
            id="committee-activity"
            className="scroll-mt-8 flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-sm dark:border-zinc-800"
          >
            <div className="p-6 border-b-2 flex items-center justify-between bg-muted/5">
              <h2 className="text-xl font-black flex items-center gap-3"><Clock className="w-6 h-6 text-primary" /> سجل النشاط المباشر</h2>
              <Button variant="ghost" size="sm" className="text-xs font-black text-muted-foreground hover:text-foreground uppercase tracking-widest">تصدير السجلات</Button>
            </div>
            <div className="divide-y-2">
              {recentActivity.length === 0 ? (
                <div className="p-24 text-center text-muted-foreground text-sm font-bold italic opacity-40">لا توجد سجلات نشاط حديثة.</div>
              ) : recentActivity.map((activity: any, i: number) => (
                <div key={activity.id || i} className="p-6 flex items-start gap-5 hover:bg-muted/30 transition-colors cursor-pointer group">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary mt-2 group-hover:scale-150 transition-transform shadow-lg shadow-primary/40 flex-shrink-0" />
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-black text-foreground leading-none">{activity.title}</p>
                    <p className="text-xs text-muted-foreground font-medium opacity-80 truncate">{activity.message}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap bg-muted px-2 py-1 rounded-md flex-shrink-0">
                    {new Date(activity.createdAt).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="group relative overflow-hidden rounded-2xl border border-indigo-900/50 bg-gradient-to-br from-zinc-900 to-indigo-950 p-8 text-white shadow-2xl shadow-indigo-500/20">
            <div className="relative z-10 flex flex-col h-full">
              <div className="bg-white/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-xl border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black leading-tight mb-3 tracking-tight">إدارة الصلاحيات</h3>
              <p className="text-xs font-bold text-white/50 mb-10 leading-relaxed">إدارة أدوار المستخدمين عبر النظام حالياً مقتصرة على المستوى الإداري الأعلى.</p>
              <Button variant="secondary" className="mt-auto font-black gap-2 text-[10px] uppercase tracking-[2px] h-12 bg-white hover:bg-zinc-100 text-indigo-950 rounded-xl shadow-lg active:scale-95 transition-all">
                طلب تصريح مسؤول <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />
          </div>

          <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-card p-8 shadow-sm dark:border-zinc-800">
            <h4 className="font-black text-xs uppercase tracking-[2px] text-muted-foreground opacity-60">مراقب نزاهة النظام</h4>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-muted-foreground">صحة قاعدة البيانات</span>
                  <span className="text-emerald-500">٩٩.٩٪</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "99.9%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-muted-foreground">سرعة الاستجابة (API)</span>
                  <span className="text-amber-500">١٢ مللي ثانية</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "85%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
