"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraduationCap, FileText, CheckCircle, Clock, Plus, AlertCircle, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEACHER_LINKS } from "@/lib/dashboard-links";

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
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-500/10",
      href: TEACHER_LINKS.exams,
    },
    {
      title: "قيد المراجعة",
      value: pendingExams,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      href: TEACHER_LINKS.examsPending,
    },
    {
      title: "تم اعتمادها",
      value: approvedExams,
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      href: TEACHER_LINKS.examsApproved,
    },
    {
      title: "مرفوضة",
      value: rejectedExams,
      icon: AlertCircle,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-500/10",
      href: TEACHER_LINKS.examsRejected,
    },
  ];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "APPROVED": return { label: "معتمد", cls: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" };
      case "PENDING_APPROVAL": return { label: "قيد المراجعة", cls: "bg-amber-500/10 text-amber-600 ring-amber-500/20" };
      case "REJECTED": return { label: "مرفوض", cls: "bg-rose-500/10 text-rose-600 ring-rose-500/20" };
      default: return { label: "مسودة", cls: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20" };
    }
  };

  const recentExams = exams.slice(0, 5);

  return (
    <div className="space-y-8 h-full animate-fade-in">
      <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">إدارة اختباراتك بدقة.</h1>
          <p className="text-muted-foreground mt-2 text-base font-bold opacity-70 italic">
            متابعة حالات الاعتماد والمراجعة والاختبارات الأخيرة.
          </p>
        </div>
        <Button asChild className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 font-black shadow-xl shadow-primary/20 transition-all active:scale-95">
          <Link href={TEACHER_LINKS.createExam} className="flex items-center gap-2">
            <Plus className="w-5 h-5" /> إنشاء اختبار جديد
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Link
            key={i}
            href={stat.href}
            className="group flex items-center gap-5 rounded-2xl border border-slate-200/90 bg-card p-6 shadow-sm transition-shadow hover:shadow-lg hover:shadow-slate-500/10 dark:border-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-inner group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[2px] mb-1 opacity-60">{stat.title}</p>
              <h3 className="text-3xl font-black text-foreground tabular-nums leading-none">{stat.value}</h3>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-card border-2 rounded-[2.5rem] shadow-sm overflow-hidden text-sm">
        <div className="p-8 border-b-2 bg-muted/5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" /> الاختبارات الأخيرة
          </h2>
          <Button variant="ghost" asChild className="text-xs font-black text-muted-foreground hover:text-foreground uppercase tracking-widest">
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
                <tr className="border-b-2 bg-muted/30">
                  <th className="py-5 px-8 font-black text-muted-foreground uppercase tracking-widest text-[10px]">عنوان الاختبار</th>
                  <th className="py-5 px-8 font-black text-muted-foreground uppercase tracking-widest text-[10px]">النوع</th>
                  <th className="py-5 px-8 font-black text-muted-foreground uppercase tracking-widest text-[10px]">تاريخ الإنشاء</th>
                  <th className="py-5 px-8 font-black text-muted-foreground uppercase tracking-widest text-[10px]">الحالة</th>
                  <th className="py-5 px-8 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y-2">
                {recentExams.map((exam) => {
                  const statusInfo = getStatusInfo(exam.status);
                  return (
                    <tr
                      key={exam.id}
                      id={`exam-${exam.id}`}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="py-5 px-8 font-black text-foreground text-sm">{exam.title}</td>
                      <td className="py-5 px-8 text-zinc-500 font-bold text-xs">{exam.type || "—"}</td>
                      <td className="py-5 px-8 text-zinc-500 font-bold">
                        {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="py-5 px-8">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-5 px-8 text-left">
                        <Button variant="outline" size="sm" asChild className="font-black rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm border-2">
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
