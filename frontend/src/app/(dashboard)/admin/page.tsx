"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Settings,
  Users,
  FileText,
  Activity,
  Zap,
  Database,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import Link from "next/link";
import { ADMIN_LINKS } from "@/common/lib/dashboard-links";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { StatCard } from "@/common/components/dashboard/StatCard";
import { StatusBadge } from "@/common/components/dashboard/StatusBadge";
import { EmptyState } from "@/common/components/dashboard/EmptyState";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { SectionCard } from "@/common/components/dashboard/SectionCard";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() =>
        setData({
          metrics: {
            totalUsers: 0,
            totalExams: 0,
            totalQuestions: 0,
            totalNotifications: 0,
          },
          roleDistribution: [],
          recentExams: [],
        })
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoading message="جارِ تحميل بيانات النظام..." />;
  }

  const metrics = data?.metrics || {
    totalUsers: 0,
    totalExams: 0,
    totalQuestions: 0,
    totalNotifications: 0,
  };
  const roleDistribution = data?.roleDistribution || [];
  const recentExams = data?.recentExams || [];

  const roleLabels: Record<string, string> = {
    TEACHER: "الأساتذة",
    COMMITTEE: "أعضاء اللجنة",
    ADMIN: "مديرو النظام",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="إدارة النظام"
        title="لوحة الإدارة"
        subtitle="نظرة شاملة على المستخدمين والاختبارات والنشاط العام للمنصة."
        actions={
          <>
            <Button
              variant="outline"
              asChild
              className="h-11 gap-2 rounded-xl border border-border bg-card px-5 font-bold text-foreground transition hover:border-foreground/30"
            >
              <Link href={ADMIN_LINKS.settings}>
                <Settings className="h-4 w-4" /> الإعدادات
              </Link>
            </Button>
            <Button
              asChild
              className="h-11 gap-2 rounded-xl bg-foreground px-5 font-bold text-background transition hover:bg-foreground/85"
            >
              <Link href={ADMIN_LINKS.users}>
                <Users className="h-4 w-4" /> المستخدمون
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي الحسابات"
          value={metrics.totalUsers}
          icon={Users}
          tone="teal"
          hint="المستخدمين المسجَّلين"
          href={ADMIN_LINKS.users}
        />
        <StatCard
          label="الاختبارات"
          value={metrics.totalExams}
          icon={FileText}
          tone="teal"
          hint="جميع الحالات"
          href={ADMIN_LINKS.examsLog}
        />
        <StatCard
          label="نقاط التقييم"
          value={metrics.totalQuestions * 3}
          icon={Zap}
          tone="orange"
          hint="إجمالي النقاط"
          href={ADMIN_LINKS.examsLog}
        />
        <StatCard
          label="الإشعارات"
          value={metrics.totalNotifications}
          icon={ShieldAlert}
          tone="neutral"
          hint="مشاكل حرجة: ٠"
          href={ADMIN_LINKS.settings}
        />
      </div>

      {/* Two-column: exams log + side panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="سجل الاختبارات"
            icon={Activity}
            action={
              <Button
                variant="ghost"
                asChild
                className="h-8 gap-1 px-3 text-xs font-bold text-brand-teal-dark hover:bg-brand-teal/10"
              >
                <Link href={ADMIN_LINKS.examsLog}>
                  عرض الكل <ChevronLeft className="h-3 w-3" />
                </Link>
              </Button>
            }
          >
            {recentExams.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="لا توجد اختبارات مسجّلة بعد"
                description="ستظهر هنا أحدث الاختبارات مع حالاتها فور إنشائها."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentExams.map((exam: any) => {
                  const teacherName = exam.teacher?.name || "النظام";
                  const initials = teacherName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s: string) => s[0])
                    .join("")
                    .toUpperCase() || "?";
                  return (
                    <li
                      key={exam.id}
                      className="group relative flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-brand-teal-light/20"
                    >
                      <span className="absolute inset-y-0 right-0 w-1 origin-bottom scale-y-0 bg-gradient-to-t from-brand-teal to-brand-orange transition-transform group-hover:scale-y-100" />

                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-brand-teal-dark text-xs font-black text-white shadow-md shadow-brand-teal/30">
                        {initials}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {teacherName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {exam.title}
                        </p>
                      </div>

                      <StatusBadge status={exam.status} />
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <SectionCard title="توزيع الأدوار" icon={Database}>
            <div className="p-6">
              {roleDistribution.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  لا يوجد مستخدمون بعد
                </p>
              ) : (
                <div className="space-y-5">
                  {roleDistribution.map((dist: any, i: number) => {
                    const pct =
                      metrics.totalUsers > 0
                        ? (dist._count.id / metrics.totalUsers) * 100
                        : 0;
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-foreground">
                            {roleLabels[dist.role] || dist.role}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {dist._count.id}
                          </span>
                        </div>
                        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-brand-teal-dark via-brand-teal to-brand-teal shadow-sm shadow-brand-teal/40 transition-all duration-1000"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>

          <div className="group relative overflow-hidden rounded-3xl border-2 border-brand-orange/25 bg-gradient-to-bl from-brand-orange/10 via-white to-brand-teal-light/30 p-6 shadow-sm transition hover:shadow-md">
            <div
              className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-brand-orange/15 blur-3xl"
              aria-hidden
            />
            <div className="relative z-10">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white shadow-lg shadow-brand-orange/30 transition group-hover:rotate-3 group-hover:scale-110">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h4 className="mt-4 text-base font-bold" style={{ color: "#1A2E2D" }}>
                الفحص الأمني
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                تشغيل فحص شامل على المنصّة للتأكّد من سلامة الإعدادات.
              </p>
              <Button className="mt-5 h-11 w-full gap-2 rounded-xl bg-brand-orange text-sm font-bold text-white shadow-md shadow-brand-orange/30 transition hover:bg-brand-orange-dark">
                تشغيل الفحص
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
