"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraduationCap, FileText, CheckCircle, Clock, Plus, AlertCircle, Loader2, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/common/ui/button";
import { TEACHER_LINKS } from "@/common/lib/dashboard-links";

export default function TeacherDashboard() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exams/teacher")
      .then(res => res.json())
      .then(d => setExams(Array.isArray(d) ? d : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const totalExams = exams.length;
  const pendingExams = exams.filter(e => e.status === "PENDING_APPROVAL").length;
  const approvedExams = exams.filter(e => e.status === "APPROVED").length;
  const rejectedExams = exams.filter(e => e.status === "REJECTED").length;

  const stats: {
    title: string;
    value: number;
    icon: typeof GraduationCap;
    color: string;
    bg: string;
    href: string;
  }[] = [
    {
      title: "إجمالي الاختبارات",
      value: totalExams,
      icon: GraduationCap,
      color: "text-brand-teal",
      bg: "bg-brand-teal/10",
      href: TEACHER_LINKS.exams,
    },
    {
      title: "قيد المراجعة",
      value: pendingExams,
      icon: Clock,
      color: "text-brand-orange",
      bg: "bg-brand-orange/10",
      href: TEACHER_LINKS.examsPending,
    },
    {
      title: "تم اعتمادها",
      value: approvedExams,
      icon: CheckCircle,
      color: "text-brand-teal",
      bg: "bg-brand-teal/10",
      href: TEACHER_LINKS.examsApproved,
    },
    {
      title: "مرفوضة",
      value: rejectedExams,
      icon: AlertCircle,
      color: "text-[#D32F2F]",
      bg: "bg-[#FFEBEB]",
      href: TEACHER_LINKS.examsRejected,
    },
  ];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "APPROVED": return { label: "معتمد", cls: "bg-[#E6F7F6] text-[#00A99D] ring-[#00A99D]/20 dark:bg-[#0D2422] dark:text-[#00C4B7] dark:ring-[#00C4B7]/20" };
      case "PENDING_APPROVAL": return { label: "قيد المراجعة", cls: "bg-[#FFF3ED] text-[#F26522] ring-[#F26522]/20 dark:bg-[#2A1F16]" };
      case "REJECTED": return { label: "مرفوض", cls: "bg-[#FFEBEB] text-[#D32F2F] ring-[#D32F2F]/20 dark:bg-[#2A1616] dark:text-[#EF5350] dark:ring-[#EF5350]/20" };
      default: return { label: "مسودة", cls: "bg-muted text-muted-foreground ring-border" };
    }
  };

  const recentExams = exams.slice(0, 5);

  return (
    <div className="space-y-8 h-full animate-fade-in">
      <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">الاختبارات</h1>
        </div>
        <Button asChild className="h-10 px-5 rounded-xl bg-primary hover:bg-[#008F84] font-medium shadow-md shadow-primary/15 transition-all active:scale-95">
          <Link href={TEACHER_LINKS.createExam} className="flex items-center gap-2">
            <Plus className="w-5 h-5" /> إنشاء اختبار جديد
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Link
            key={i}
            href={stat.href}
            className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className={`shrink-0 p-3.5 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-200`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1 opacity-70">{stat.title}</p>
              <h3 className="text-3xl font-bold text-foreground tabular-nums leading-none">{stat.value}</h3>
            </div>
            {/* Filter affordance hint */}
            <ArrowLeft className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0 transition-all duration-200 ${stat.color}`} />
          </Link>
        ))}
      </div>
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden text-sm">
        <div className="p-6 border-b bg-muted/5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> الاختبارات الأخيرة
          </h2>
          <Button variant="ghost" asChild className="text-xs font-medium text-muted-foreground hover:text-foreground">
            <Link href={TEACHER_LINKS.exams}>عرض الكل</Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-24 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-sm font-black tracking-widest text-muted-foreground">جارِ تحميل اختباراتك...</p>
          </div>
        ) : recentExams.length === 0 ? (
          <div className="p-24 text-center space-y-4">
            <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto opacity-20">
              <GraduationCap className="w-10 h-10" />
            </div>
            <p className="text-muted-foreground font-bold text-lg">لا توجد اختبارات بعد</p>
            <p className="text-muted-foreground/60 text-sm">ابدأ بإنشاء أول اختبار لك الآن</p>
            <Button asChild className="mt-4 font-bold">
              <Link href={TEACHER_LINKS.createExam} className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> إنشاء اختبار جديد
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b-2 bg-[#F8F8F8] dark:bg-[#162A28] dark:border-[#1E3330]">
                  <th className="py-4 px-6 font-medium text-muted-foreground text-xs">عنوان الاختبار</th>
                  <th className="py-4 px-6 font-medium text-muted-foreground text-xs">النوع</th>
                  <th className="py-4 px-6 font-medium text-muted-foreground text-xs">تاريخ الإنشاء</th>
                  <th className="py-4 px-6 font-medium text-muted-foreground text-xs">الحالة</th>
                  <th className="py-4 px-6 font-medium text-muted-foreground text-xs text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y-2">
                {recentExams.map((exam) => {
                  const statusInfo = getStatusInfo(exam.status);
                  return (
                    <tr
                      key={exam.id}
                      id={`exam-${exam.id}`}
                      className="hover:bg-[#F0FAFA] transition-colors group cursor-pointer"
                    >
                      <td className="py-4 px-6 font-medium text-foreground text-sm">{exam.title}</td>
                      <td className="py-4 px-6 text-muted-foreground text-xs">{exam.type || "—"}</td>
                      <td className="py-4 px-6 text-muted-foreground text-xs font-medium">
                        {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ring-1 ring-inset ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-left">
                        <Button variant="outline" size="sm" asChild className="font-medium rounded-lg hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm">
                          <Link
                            href={`/teacher/exams#exam-${exam.id}`}
                            className="flex items-center gap-1"
                          >
                            تفاصيل <ChevronRight className="w-3 h-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
