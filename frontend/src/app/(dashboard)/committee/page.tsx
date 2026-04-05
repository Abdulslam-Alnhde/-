"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle, Clock, FileText,
  BarChart3, Users, ExternalLink, AlertCircle, Loader2, ChevronLeft,
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
      color: "text-brand-orange",
      bg: "bg-brand-orange/10",
      href: COMMITTEE_LINKS.queue,
    },
    {
      label: "تم اعتمادها",
      val: stats.approved,
      icon: CheckCircle,
      color: "text-brand-teal",
      bg: "bg-brand-teal/10",
      href: COMMITTEE_LINKS.activity,
    },
    {
      label: "نماذج مرفوضة",
      val: stats.rejected,
      icon: AlertCircle,
      color: "text-[#D32F2F]",
      bg: "bg-[#FFEBEB]",
      href: COMMITTEE_LINKS.queue,
    },
    {
      label: "إجمالي المراجعات",
      val: stats.totalReviewed,
      icon: BarChart3,
      color: "text-brand-teal",
      bg: "bg-brand-teal/10",
      href: COMMITTEE_LINKS.kpis,
    },
  ];

  return (
    <div className="space-y-8 h-full animate-fade-in">
      {statsError && (
        <div
          role="alert"
          className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm font-bold text-brand-orange"
        >
          {statsError}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            لوحة اللجنة
          </h1>
        </div>
        <Button asChild className="gap-2 h-10 px-5 rounded-xl shadow-md shadow-primary/15 bg-brand-teal hover:bg-brand-teal/90 font-medium">
          <Link href={COMMITTEE_LINKS.queue}>
            <FileText className="w-4 h-4" /> قائمة المراجعة
          </Link>
        </Button>
      </div>

      {pendingPreview.length > 0 && (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-brand-orange">
              بانتظار المراجعة
            </h2>
            <Link
              href={COMMITTEE_LINKS.queue}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
            >
              عرض الكل
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
          <ul className="space-y-2">
            {pendingPreview.map((ex) => (
              <li key={ex.id}>
                <Link
                  href={`/committee/queue?examId=${ex.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEEEEE] bg-white/80 px-4 py-3 text-sm font-medium shadow-sm transition hover:border-brand-teal/30 hover:bg-white dark:border-[#1E3330] dark:bg-card/80 dark:hover:bg-card"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {ex.title}
                  </span>
                  <span className="shrink-0 text-xs text-brand-teal">
                    مراجعة ←
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
            className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg hover:shadow-black/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className={`p-4 rounded-2xl ${item.bg} ${item.color} shadow-inner`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-muted-foreground mb-1 opacity-70">{item.label}</p>
                <h3 className="text-3xl font-bold leading-none text-foreground">{item.val}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div
            id="committee-activity"
            className="scroll-mt-8 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div className="p-6 border-b flex items-center justify-between bg-muted/5">
              <h2 className="text-base font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> سجل النشاط</h2>
            </div>
            <div className="divide-y-2">
              {recentActivity.length === 0 ? (
                <div className="p-24 text-center text-muted-foreground text-sm font-bold italic opacity-40">لا توجد سجلات نشاط حديثة.</div>
              ) : recentActivity.map((activity: any, i: number) => (
                <div key={activity.id || i} className="p-6 flex items-start gap-5 hover:bg-muted/30 transition-colors cursor-pointer group">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary mt-2 group-hover:scale-150 transition-transform shadow-lg shadow-primary/40 flex-shrink-0" />
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-none">{activity.title}</p>
                    <p className="text-xs text-muted-foreground opacity-80 truncate">{activity.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2 py-1 rounded-md flex-shrink-0">
                    {new Date(activity.createdAt).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="group relative overflow-hidden rounded-2xl border border-[#E0F0EF] bg-card p-6 text-foreground shadow-sm">
            <div className="relative z-10 flex flex-col h-full">
              <div className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center shadow-inner">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold mt-4 mb-2">إدارة الصلاحيات</h3>
              <Button variant="secondary" className="mt-4 font-medium gap-2 text-sm h-10 bg-white hover:bg-white/90 text-brand-teal rounded-xl shadow active:scale-95 transition-all">
                طلب تصريح <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-brand-teal/20 rounded-full blur-[80px] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
