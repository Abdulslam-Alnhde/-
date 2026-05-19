"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  FileText,
  CheckCircle,
  Clock,
  Plus,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import { TEACHER_LINKS } from "@/common/lib/dashboard-links";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { StatCard } from "@/common/components/dashboard/StatCard";
import { StatusBadge } from "@/common/components/dashboard/StatusBadge";
import { EmptyState } from "@/common/components/dashboard/EmptyState";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { SectionCard } from "@/common/components/dashboard/SectionCard";

export default function TeacherDashboard() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exams/teacher")
      .then((res) => res.json())
      .then((d) => setExams(Array.isArray(d) ? d : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const totalExams = exams.length;
  const pendingExams = exams.filter((e) => e.status === "PENDING_APPROVAL").length;
  const approvedExams = exams.filter((e) => e.status === "APPROVED").length;
  const rejectedExams = exams.filter((e) => e.status === "REJECTED").length;
  const recentExams = exams.slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="لوحة الأستاذ"
        title="الاختبارات"
        subtitle="نظرة سريعة على اختباراتك ومراحل اعتمادها."
        actions={
          <Button
            asChild
            className="h-11 gap-2 rounded-xl bg-foreground px-5 font-bold text-background transition hover:bg-foreground/85"
          >
            <Link href={TEACHER_LINKS.createExam}>
              <Plus className="h-4 w-4" /> إنشاء اختبار جديد
            </Link>
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي الاختبارات"
          value={totalExams}
          icon={GraduationCap}
          tone="teal"
          href={TEACHER_LINKS.exams}
        />
        <StatCard
          label="قيد المراجعة"
          value={pendingExams}
          icon={Clock}
          tone="orange"
          href={TEACHER_LINKS.examsPending}
        />
        <StatCard
          label="معتمدة"
          value={approvedExams}
          icon={CheckCircle}
          tone="teal"
          href={TEACHER_LINKS.examsApproved}
        />
        <StatCard
          label="مرفوضة"
          value={rejectedExams}
          icon={AlertCircle}
          tone="danger"
          href={TEACHER_LINKS.examsRejected}
        />
      </div>

      {/* Recent exams */}
      <SectionCard
        title="الاختبارات الأخيرة"
        icon={FileText}
        action={
          <Button
            variant="ghost"
            asChild
            className="h-8 gap-1 px-3 text-xs font-bold text-brand-teal-dark hover:bg-brand-teal/10 hover:text-brand-teal-dark"
          >
            <Link href={TEACHER_LINKS.exams}>
              عرض الكل <ChevronLeft className="h-3 w-3" />
            </Link>
          </Button>
        }
      >
        {loading ? (
          <PageLoading message="جارِ تحميل اختباراتك..." />
        ) : recentExams.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="لا توجد اختبارات بعد"
            description="ابدأ بإنشاء أوّل اختبار لك الآن، وستظهر هنا فور الإنشاء."
            action={
              <Button asChild className="h-11 gap-2 rounded-xl bg-brand-orange font-bold text-white shadow-md shadow-brand-orange/30 hover:bg-brand-orange-dark">
                <Link href={TEACHER_LINKS.createExam}>
                  <Plus className="h-4 w-4" /> إنشاء اختبار جديد
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {recentExams.map((exam) => (
              <li
                key={exam.id}
                id={`exam-${exam.id}`}
                className="group relative flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-brand-teal-light/20"
              >
                {/* hover accent bar (right side in RTL) */}
                <span className="absolute inset-y-0 right-0 w-1 origin-bottom scale-y-0 bg-gradient-to-t from-brand-teal to-brand-orange transition-transform group-hover:scale-y-100" />

                {/* Icon avatar */}
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal-light to-white text-brand-teal-dark ring-1 ring-brand-teal/20 transition group-hover:ring-brand-teal/40">
                  <FileText className="h-5 w-5" />
                </span>

                {/* Title + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {exam.title}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                    <span>{exam.type || "اختبار عام"}</span>
                    <span aria-hidden>•</span>
                    <span className="tabular-nums">
                      {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={exam.status} />

                {/* CTA */}
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-9 gap-1 rounded-lg border-2 border-border font-bold text-brand-teal-dark transition group-hover:border-brand-teal group-hover:bg-brand-teal group-hover:text-white"
                >
                  <Link href={`/teacher/exams#exam-${exam.id}`}>
                    تفاصيل <ChevronLeft className="h-3 w-3" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
