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
  Loader2,
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

/* ─────────────────────────────────────────────────────────────────
   Types & constants
───────────────────────────────────────────────────────────────── */

type StatusKey = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

const VALID_STATUSES: StatusKey[] = ["PENDING_APPROVAL", "APPROVED", "REJECTED"];

interface FilterDef {
  key: StatusKey;
  label: string;
  icon: React.ElementType;
  pillActive: string;
  pillInactive: string;
  countActive: string;
  countInactive: string;
}

const FILTER_DEFS: FilterDef[] = [
  {
    key: "PENDING_APPROVAL",
    label: "قيد المراجعة",
    icon: Clock,
    pillActive:
      "border-brand-teal bg-brand-teal text-white shadow-lg shadow-brand-teal/20",
    pillInactive:
      "border-border bg-card text-muted-foreground hover:border-brand-teal/30 hover:text-brand-teal",
    countActive: "bg-white/20 text-white",
    countInactive: "bg-muted text-muted-foreground",
  },
  {
    key: "APPROVED",
    label: "معتمدة",
    icon: CheckCircle2,
    pillActive:
      "border-brand-teal bg-brand-teal text-white shadow-lg shadow-brand-teal/20",
    pillInactive:
      "border-border bg-card text-muted-foreground hover:border-brand-teal/30 hover:text-brand-teal",
    countActive: "bg-white/20 text-white",
    countInactive: "bg-muted text-muted-foreground",
  },
  {
    key: "REJECTED",
    label: "مرفوضة",
    icon: AlertCircle,
    pillActive:
      "border-brand-teal bg-brand-teal text-white shadow-lg shadow-brand-teal/20",
    pillInactive:
      "border-border bg-card text-muted-foreground hover:border-brand-teal/30 hover:text-brand-teal",
    countActive: "bg-white/20 text-white",
    countInactive: "bg-muted text-muted-foreground",
  },
];

/* ─────────────────────────────────────────────────────────────────
   Helper sub-components
───────────────────────────────────────────────────────────────── */

function TypeBadge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card/50 px-2 py-0.5 font-inter text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00A99D] bg-[#E6F7F6] px-3 py-1 text-xs font-medium text-[#00A99D] dark:bg-[#0D2422] dark:text-[#00C4B7] dark:border-[#00C4B7]">
          <CheckCircle2 className="h-3 w-3" /> معتمد
        </span>
      );
    case "PENDING_APPROVAL":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F26522] bg-[#FFF3ED] px-3 py-1 text-xs font-medium text-[#F26522] dark:bg-[#2A1F16]">
          <Clock className="h-3 w-3" /> قيد المراجعة
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D32F2F] bg-[#FFEBEB] px-3 py-1 text-xs font-medium text-[#D32F2F] dark:bg-[#2A1616] dark:text-[#EF5350] dark:border-[#EF5350]">
          <AlertCircle className="h-3 w-3" /> مرفوض
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          مسودة
        </span>
      );
  }
}

/* ─────────────────────────────────────────────────────────────────
   Main page content
───────────────────────────────────────────────────────────────── */

function TeacherExamsContent() {
  const searchParams = useSearchParams();

  /* ── Data ── */
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Multi-select filter state ── */
  const [activeStatuses, setActiveStatuses] = useState<StatusKey[]>([]);

  /* Initialise from URL ?status= on first render / URL change */
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

  /* ── Derived counts ── */
  const counts = useMemo(
    () => ({
      all: exams.length,
      PENDING_APPROVAL: exams.filter((e) => e.status === "PENDING_APPROVAL").length,
      APPROVED: exams.filter((e) => e.status === "APPROVED").length,
      REJECTED: exams.filter((e) => e.status === "REJECTED").length,
    }),
    [exams]
  );

  /* ── Filtered list ── */
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const nameOk = exam.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (activeStatuses.length === 0) return nameOk;
      return nameOk && activeStatuses.includes(exam.status as StatusKey);
    });
  }, [exams, searchQuery, activeStatuses]);

  /* ── Toggle helpers ── */
  const toggleStatus = (key: StatusKey) => {
    setActiveStatuses((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const clearFilters = () => setActiveStatuses([]);

  const isAllActive = activeStatuses.length === 0;

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-6 rounded-[2rem] bg-card p-4 font-cairo font-medium text-foreground animate-in fade-in duration-500 sm:p-6">

      {/* ── Page title row ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-brand-teal">
            <FileText className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            مستودع الاختبارات
          </h1>
        </div>
        <Button
          asChild
          className="h-11 gap-2 rounded-2xl bg-brand-teal px-5 font-bold text-white shadow-lg shadow-brand-teal/20 hover:bg-brand-teal/90"
        >
          <Link href={TEACHER_LINKS.createExam}>
            <Plus className="h-4 w-4" />
            إنشاء اختبار جديد
          </Link>
        </Button>
      </div>

      {/* ── Main repository card ── */}
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-2xl shadow-black/15">

        {/* Card header: title + search */}
        <div className="flex flex-col gap-4 border-b border-border bg-card px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-brand-teal">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-foreground">
              الاختبارات
            </h2>
            {!loading && (
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-teal">
                {filteredExams.length}
              </span>
            )}
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="بحث"
              className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm font-medium text-foreground transition placeholder:text-muted-foreground focus:border-brand-teal/70 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
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
        </div>

        {/* Filter pills row */}
        <div className="border-b border-border px-5 py-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* "الكل" pill */}
            <button
              type="button"
              onClick={clearFilters}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-bold transition-all duration-150",
                isAllActive
                  ? "border-brand-teal bg-brand-teal text-white shadow-lg shadow-brand-teal/20"
                  : "border-border bg-card text-muted-foreground hover:border-brand-teal/30 hover:text-brand-teal"
              )}
            >
              <GraduationCap className="h-4 w-4 shrink-0" />
              الكل
              {!loading && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                    isAllActive
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {counts.all}
                </span>
              )}
            </button>

            {/* Status pills — multi-selectable */}
            {FILTER_DEFS.map((f) => {
              const isActive = activeStatuses.includes(f.key);
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleStatus(f.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-bold transition-all duration-150",
                    isActive ? f.pillActive : f.pillInactive
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {f.label}
                  {!loading && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                        isActive ? f.countActive : f.countInactive
                      )}
                    >
                      {counts[f.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table / states */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-brand-teal" />
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="space-y-4 py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card text-muted-foreground">
              <FileText className="h-7 w-7" />
            </div>
            <p className="font-bold text-muted-foreground">
              لا توجد اختبارات
            </p>
            <div className="flex items-center justify-center gap-3">
              {activeStatuses.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border bg-card font-bold text-foreground hover:bg-muted hover:text-foreground"
                  onClick={clearFilters}
                >
                  عرض الكل
                </Button>
              )}
              <Button size="sm" asChild className="rounded-xl bg-brand-teal font-bold text-white hover:bg-brand-teal/90">
                <Link href={TEACHER_LINKS.createExam}>إنشاء اختبار جديد</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b border-[#EEEEEE] bg-[#F8F8F8] text-xs font-bold text-muted-foreground dark:border-[#1E3330] dark:bg-[#162A28] dark:text-[#A8C8C6]">
                  <th className="px-6 py-4">تفاصيل الاختبار</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">الأسئلة</th>
                  <th className="px-6 py-4">الدرجة الكلية</th>
                  <th className="px-6 py-4" />
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
                      className="group transition-colors hover:bg-[#F0FAFA] dark:hover:bg-[#1E3530]"
                    >
                      {/* Exam details */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <p className="font-medium text-foreground transition-colors group-hover:text-brand-teal">
                            {exam.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <TypeBadge>{exam.type}</TypeBadge>
                            <span className="font-inter text-[10px] font-medium text-muted-foreground">
                              {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                            </span>
                          </div>
                          {exam.status === "REJECTED" && exam.committeeFeedback && (
                            <p className="mt-1.5 max-w-xl rounded-xl border border-[#D32F2F]/20 bg-[#FFEBEB] px-3 py-2 text-xs font-medium leading-relaxed text-[#D32F2F] dark:bg-[#2A1616] dark:border-[#EF5350]/20 dark:text-[#EF5350]">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#D32F2F] dark:text-[#EF5350]">
                                ملاحظة اللجنة:{" "}
                              </span>
                              {exam.committeeFeedback}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4">{getStatusBadge(exam.status)}</td>

                      {/* Questions count */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 font-inter text-sm font-bold tabular-nums text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          {exam._count?.questions ?? exam.questions?.length ?? 0}
                        </span>
                      </td>

                      {/* Total grade */}
                      <td className="px-6 py-4">
                        <span className="font-inter text-sm font-bold tabular-nums text-brand-teal">
                          {formatExamTotalGradeAr(exam.totalGrade)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {exam.status === "REJECTED" && (
                            <Button
                              asChild
                              size="sm"
                              variant="secondary"
                              className="h-8 rounded-xl border border-border bg-muted text-xs font-bold text-foreground hover:bg-muted/80"
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
                            className="h-8 rounded-xl border-border bg-card text-xs font-bold text-foreground hover:border-brand-teal hover:bg-brand-teal hover:text-white"
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
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Page export with Suspense boundary (required for useSearchParams)
───────────────────────────────────────────────────────────────── */

export default function TeacherExamsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-[2rem] bg-card p-24">
          <Loader2 className="h-12 w-12 animate-spin text-brand-teal" />
        </div>
      }
    >
      <TeacherExamsContent />
    </Suspense>
  );
}
