"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import {
  FileText,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "@/lib/motion";
import { TEACHER_LINKS, teacherExamDetailPath } from "@/lib/dashboard-links";
import { formatExamTotalGradeAr } from "@/lib/exam-points-display";

const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "قيد المراجعة",
  APPROVED: "معتمدة",
  REJECTED: "مرفوضة",
};

function TeacherExamsContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    axios
      .get("/api/exams/teacher")
      .then((res) => setExams(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const nameOk = exam.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!statusFilter) return nameOk;
      return nameOk && exam.status === statusFilter;
    });
  }, [exams, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> معتمد
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
            <Clock className="h-3 w-3" /> قيد المراجعة
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-600">
            <AlertCircle className="h-3 w-3" /> مرفوض
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">
            مسودة
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-black tracking-tight underline decoration-primary decoration-4 underline-offset-8">
          مستودع الاختبارات
        </h1>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          إدارة وتتبع النماذج الامتحانية الخاصة بك. لإنشاء اختبار جديد استخدم{" "}
          <Link
            href={TEACHER_LINKS.dashboard}
            className="font-bold text-primary underline-offset-4 hover:underline"
          >
            لوحة التحكم
          </Link>
          .
        </p>
      </div>

      {statusFilter && STATUS_LABELS[statusFilter] && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-3 text-sm font-bold dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <span className="text-muted-foreground">التصفية النشطة:</span>
          <span className="rounded-lg bg-white px-3 py-1 font-black text-indigo-800 dark:bg-zinc-900 dark:text-indigo-200">
            {STATUS_LABELS[statusFilter]}
          </span>
          <Button variant="outline" size="sm" asChild className="mr-auto rounded-xl">
            <Link href={TEACHER_LINKS.exams}>عرض الكل</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث عن اختبار بالاسم..."
            className="w-full rounded-2xl border bg-card py-4 pl-4 pr-12 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {statusFilter ? (
          <Button
            variant="outline"
            className="h-[58px] gap-2 rounded-2xl border-2 font-bold"
            asChild
          >
            <Link href={TEACHER_LINKS.exams}>
              <Filter className="h-4 w-4" /> عرض كل الحالات
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-[58px] gap-2 rounded-2xl border-2 font-bold opacity-80"
            disabled
          >
            <Filter className="h-4 w-4" /> استخدم البطاقات في الرئيسية للتصفية
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg shadow-zinc-500/5">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 p-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-black tracking-widest text-muted-foreground">
              جارِ تحميل المستودع...
            </p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="space-y-4 p-24 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted opacity-20">
              <FileText className="h-8 w-8" />
            </div>
            <p className="font-medium text-muted-foreground">
              لا توجد نتائج مطابقة للتصفية أو البحث.
            </p>
            <p className="text-sm text-muted-foreground">
              لإنشاء اختبار جديد انتقل إلى{" "}
              <Link
                href={TEACHER_LINKS.dashboard}
                className="font-bold text-primary underline-offset-4 hover:underline"
              >
                لوحة التحكم
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b bg-muted/30 text-[10px] font-black uppercase tracking-[2px] text-muted-foreground">
                  <th className="px-8 py-5">تفاصيل الاختبار</th>
                  <th className="px-8 py-5">الحالة</th>
                  <th className="px-8 py-5">الأسئلة</th>
                  <th className="px-8 py-5">الدرجة</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <AnimatePresence>
                  {filteredExams.map((exam, i) => (
                    <motion.tr
                      key={exam.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="font-black text-foreground transition-colors group-hover:text-primary">
                            {exam.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <Badge variant="outline" className="h-5">
                              {exam.type}
                            </Badge>
                            <span>•</span>
                            <span>
                              {new Date(exam.createdAt).toLocaleDateString(
                                "ar-EG"
                              )}
                            </span>
                          </div>
                          {exam.status === "REJECTED" &&
                            exam.committeeFeedback && (
                              <p className="mt-2 max-w-xl rounded-lg border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-xs font-bold leading-relaxed text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
                                <span className="text-[10px] font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
                                  ملاحظة اللجنة:{" "}
                                </span>
                                {exam.committeeFeedback}
                              </p>
                            )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {getStatusBadge(exam.status)}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 font-black text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />{" "}
                          {exam._count?.questions || exam.questions?.length || 0}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black text-emerald-600 tabular-nums">
                          {formatExamTotalGradeAr(exam.totalGrade)}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-2">
                          {exam.status === "REJECTED" && (
                            <Button
                              asChild
                              size="sm"
                              variant="secondary"
                              className="h-9 rounded-lg font-black text-xs"
                            >
                              <Link
                                href={`${TEACHER_LINKS.createExam}?edit=${encodeURIComponent(exam.id)}`}
                              >
                                تعديل وإعادة الإرسال
                              </Link>
                            </Button>
                          )}
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg font-black text-xs"
                          >
                            <Link href={teacherExamDetailPath(exam.id)}>
                              تفاصيل
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: import("react").ReactNode;
  variant?: string;
  className?: string;
}) {
  const styles =
    variant === "outline"
      ? "border-muted text-muted-foreground"
      : "bg-primary text-primary-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black ${styles} ${className}`}
    >
      {children}
    </span>
  );
}

export default function TeacherExamsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-4 p-24">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm font-black text-muted-foreground">
            جارٍ تحميل المستودع…
          </p>
        </div>
      }
    >
      <TeacherExamsContent />
    </Suspense>
  );
}
