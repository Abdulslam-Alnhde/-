"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import {
  FileText,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  X,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "@/common/lib/motion";
import { TEACHER_LINKS, teacherExamDetailPath } from "@/common/lib/dashboard-links";
import { formatExamTotalGradeAr } from "@/modules/exams/lib/exam-scoring";
import { cn } from "@/common/lib/utils";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { SectionCard } from "@/common/components/dashboard/SectionCard";
import { StatusBadge } from "@/common/components/dashboard/StatusBadge";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { EmptyState } from "@/common/components/dashboard/EmptyState";

/* ─────────────────────────────────────────────────────────────────
   Types & constants
───────────────────────────────────────────────────────────────── */

type StatusKey = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

const VALID_STATUSES: StatusKey[] = ["PENDING_APPROVAL", "APPROVED", "REJECTED"];

const FILTER_DEFS: { key: StatusKey; label: string; icon: React.ElementType }[] = [
  { key: "PENDING_APPROVAL", label: "قيد المراجعة", icon: Clock },
  { key: "APPROVED", label: "معتمدة", icon: CheckCircle2 },
  { key: "REJECTED", label: "مرفوضة", icon: AlertCircle },
];

/* ─────────────────────────────────────────────────────────────────
   Helper sub-components
───────────────────────────────────────────────────────────────── */

function TypeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-inter text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Main page content
───────────────────────────────────────────────────────────────── */

function TeacherExamsContent() {
  const searchParams = useSearchParams();

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<StatusKey[]>([]);

  useEffect(() => {
    const urlStatus = searchParams.get("status") as StatusKey | null;
    if (urlStatus && VALID_STATUSES.includes(urlStatus)) {
      setActiveStatuses([urlStatus]);
    } else {
      setActiveStatuses([]);
    }
  }, [searchParams]);

  useEffect(() => {
    axios
      .get("/api/exams/teacher")
      .then((res) => setExams(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      all: exams.length,
      PENDING_APPROVAL: exams.filter((e) => e.status === "PENDING_APPROVAL").length,
      APPROVED: exams.filter((e) => e.status === "APPROVED").length,
      REJECTED: exams.filter((e) => e.status === "REJECTED").length,
    }),
    [exams]
  );

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const nameOk = exam.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (activeStatuses.length === 0) return nameOk;
      return nameOk && activeStatuses.includes(exam.status as StatusKey);
    });
  }, [exams, searchQuery, activeStatuses]);

  const toggleStatus = (key: StatusKey) => {
    setActiveStatuses((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const clearFilters = () => setActiveStatuses([]);
  const isAllActive = activeStatuses.length === 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow="الأستاذ"
        title="مستودع الاختبارات"
        subtitle="تابع جميع اختباراتك وحالتها في مكان واحد."
        actions={
          <Button
            asChild
            className="h-11 gap-2 rounded-xl bg-brand-teal px-5 font-bold text-white hover:bg-brand-teal/90"
          >
            <Link href={TEACHER_LINKS.createExam}>
              <Plus className="h-4 w-4" />
              إنشاء اختبار جديد
            </Link>
          </Button>
        }
      />

      <SectionCard
        title="الاختبارات"
        icon={FileText}
        action={
          !loading && (
            <span className="rounded-full bg-brand-teal-light px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-teal-dark">
              {filteredExams.length}
            </span>
          )
        }
      >
        {/* Search + filters */}
        <div className="space-y-4 border-b border-border px-6 py-5">
          <div className="relative w-full sm:w-80">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="بحث"
              placeholder="ابحث باسم الاختبار..."
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-sm font-medium text-foreground transition placeholder:text-muted-foreground focus:border-brand-teal/70 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              active={isAllActive}
              icon={GraduationCap}
              label="الكل"
              count={loading ? undefined : counts.all}
              onClick={clearFilters}
            />
            {FILTER_DEFS.map((f) => (
              <FilterPill
                key={f.key}
                active={activeStatuses.includes(f.key)}
                icon={f.icon}
                label={f.label}
                count={loading ? undefined : counts[f.key]}
                onClick={() => toggleStatus(f.key)}
              />
            ))}
          </div>
        </div>

        {/* Table / states */}
        {loading ? (
          <PageLoading message="جارِ تحميل الاختبارات..." />
        ) : filteredExams.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="لا توجد اختبارات"
            description="لم نعثر على اختبارات مطابقة. جرّب تعديل البحث أو أنشئ اختباراً جديداً."
            action={
              <div className="flex items-center justify-center gap-3">
                {activeStatuses.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold"
                    onClick={clearFilters}
                  >
                    عرض الكل
                  </Button>
                )}
                <Button
                  size="sm"
                  asChild
                  className="rounded-xl bg-brand-teal font-bold text-white hover:bg-brand-teal/90"
                >
                  <Link href={TEACHER_LINKS.createExam}>إنشاء اختبار جديد</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                  <th className="px-6 py-3.5">تفاصيل الاختبار</th>
                  <th className="px-6 py-3.5">الحالة</th>
                  <th className="px-6 py-3.5">الأسئلة</th>
                  <th className="px-6 py-3.5">الدرجة الكلية</th>
                  <th className="px-6 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <AnimatePresence>
                  {filteredExams.map((exam, i) => (
                    <motion.tr
                      key={exam.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.04 }}
                      className="group transition-colors hover:bg-brand-teal-light/40"
                    >
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <p className="font-bold text-foreground transition-colors group-hover:text-brand-teal">
                            {exam.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <TypeBadge>{exam.type}</TypeBadge>
                            <span className="font-inter text-[10px] font-medium text-muted-foreground">
                              {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                            </span>
                          </div>
                          {exam.status === "REJECTED" && exam.committeeFeedback && (
                            <p className="mt-1.5 max-w-xl rounded-xl border border-[#D32F2F]/20 bg-[#FFEBEB] px-3 py-2 text-xs font-medium leading-relaxed text-[#D32F2F]">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#D32F2F]">
                                ملاحظة اللجنة:{" "}
                              </span>
                              {exam.committeeFeedback}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={exam.status} />
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 font-inter text-sm font-bold tabular-nums text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          {exam._count?.questions ?? exam.questions?.length ?? 0}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-inter text-sm font-bold tabular-nums text-brand-teal">
                          {formatExamTotalGradeAr(exam.totalGrade)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {exam.status === "REJECTED" && (
                            <Button
                              asChild
                              size="sm"
                              variant="secondary"
                              className="h-8 rounded-xl text-xs font-bold"
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
                            className="h-8 rounded-xl text-xs font-bold hover:border-brand-teal hover:bg-brand-teal hover:text-white"
                          >
                            <Link href={teacherExamDetailPath(exam.id)}>
                              تفاصيل <ArrowLeft className="mr-1 h-3 w-3" />
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
      </SectionCard>
    </div>
  );
}

/* ── Filter pill ── */
function FilterPill({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition-all duration-150",
        active
          ? "border-brand-teal bg-brand-teal text-white"
          : "border-border bg-card text-muted-foreground hover:border-brand-teal/40 hover:text-brand-teal"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
            active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function TeacherExamsPage() {
  return (
    <Suspense fallback={<PageLoading message="جارِ التحميل..." />}>
      <TeacherExamsContent />
    </Suspense>
  );
}
