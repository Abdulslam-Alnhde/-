"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "@/lib/motion";
import { GradingResultsView } from "@/components/exams/GradingResultsView";
import { ExtractionVerificationView } from "@/components/exams/ExtractionVerificationView";
import {
  Check,
  CheckCircle2,
  XCircle,
  FileText,
  UploadCloud,
  SplitSquareHorizontal,
  Loader2,
  AlertCircle,
  Clock,
  User,
  ListChecks,
  ShieldCheck,
  Eye,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExamStore } from "@/store/useExamStore";
import { hasPermission, PERMISSION_KEYS } from "@/lib/permissions";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import { formatScore2 } from "@/lib/score-format";

type StepId = 1 | 2 | 3 | 4;

function CommitteeQueuePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<{
    role: string;
    permissionKeys: string[];
  } | null>(null);

  const [pendingExams, setPendingExams] = useState<any[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reExtractingNum, setReExtractingNum] = useState<number | null>(null);

  const {
    extractedStudentAnswers,
    setExtractedStudentAnswers,
    updateStudentAnswer,
    updateStudentAnswerByQuestionNumber,
  } = useExamStore();

  const [isGrading, setIsGrading] = useState(false);
  const [gradingResults, setGradingResults] = useState<any | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [examPreviewOpen, setExamPreviewOpen] = useState(false);
  const [examPreviewAcknowledged, setExamPreviewAcknowledged] =
    useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((p) => p - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    fetchPendingExams();
  }, []);

  useEffect(() => {
    if (!pendingLoaded) return;
    const id = searchParams.get("examId");
    if (!id) return;
    const ex = pendingExams.find((e: any) => e.id === id);
    if (ex && selectedExam?.id !== id) {
      setSelectedExam(ex);
      setStudentFile(null);
      setExtractedStudentAnswers([]);
      setGradingResults(null);
    }
  }, [
    searchParams,
    pendingLoaded,
    pendingExams,
    selectedExam?.id,
    setExtractedStudentAnswers,
  ]);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data) =>
        setMe({
          role: data.role ?? "COMMITTEE",
          permissionKeys: Array.isArray(data.permissionKeys)
            ? data.permissionKeys
            : [],
        })
      )
      .catch(() =>
        setMe({ role: "COMMITTEE", permissionKeys: [] })
      );
  }, []);

  const canEditExtract =
    me !== null &&
    hasPermission(
      me.role,
      me.permissionKeys,
      PERMISSION_KEYS.EDIT_STUDENT_EXTRACT
    );
  const canReRunGrading =
    me !== null &&
    hasPermission(
      me.role,
      me.permissionKeys,
      PERMISSION_KEYS.RE_RUN_GRADING
    );
  const canApproveExam =
    me !== null &&
    hasPermission(me.role, me.permissionKeys, PERMISSION_KEYS.APPROVE_EXAMS);

  const fetchPendingExams = async () => {
    const res = await fetch("/api/exams/pending");
    const data = await res.json();
    setPendingExams(Array.isArray(data) ? data : []);
    setPendingLoaded(true);
  };

  const handleExamClick = useCallback(
    (exam: any) => {
      setSelectedExam(exam);
      setStudentFile(null);
      setExtractedStudentAnswers([]);
      setGradingResults(null);
      setExamPreviewAcknowledged(false);
      router.replace(`/committee/queue?examId=${exam.id}`, { scroll: false });
    },
    [router, setExtractedStudentAnswers]
  );

  useEffect(() => {
    if (!selectedExam?.id) setExamPreviewAcknowledged(false);
  }, [selectedExam?.id]);

  /**
   * ترقيم ثابت لأسئلة الاختبار:
   * - يفضّل displayLabel إن كان صالحاً وغير مكرر.
   * - عند التكرار/الفراغ نرجع إلى الترقيم التسلسلي (1..N) لضمان عدم ظهور 4.4 مرتين.
   */
  const stableLabelsByIndex = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const qs = Array.isArray(selectedExam?.questions)
      ? selectedExam.questions
      : [];
    qs.forEach((q: any, i: number) => {
      const preferred = getQuestionDisplayLabel(
        { displayLabel: q?.displayLabel },
        i
      );
      let label = preferred?.trim() || "";
      if (!label || seen.has(label)) {
        label = String(i + 1);
        if (seen.has(label)) {
          let k = 2;
          while (seen.has(`${i + 1}.${k}`)) k += 1;
          label = `${i + 1}.${k}`;
        }
      }
      seen.add(label);
      out[i] = label;
    });
    return out;
  }, [selectedExam?.questions]);

  const stableLabelForIndex = useCallback(
    (index: number) => stableLabelsByIndex[index] || String(index + 1),
    [stableLabelsByIndex]
  );

  const gradingDisplayResults = useMemo(() => {
    const rows = gradingResults?.breakdown;
    if (!Array.isArray(rows)) return [];
    return rows.map((row: any) => {
      const live = extractedStudentAnswers.find(
        (a: any) => a.questionNumber === row.questionNumber
      );
      const qi = Number(row.questionNumber) - 1;
      return {
        ...row,
        studentAnswer: live?.studentAnswer ?? row.studentAnswer,
        displayLabel:
          row.displayLabel || stableLabelForIndex(qi >= 0 ? qi : 0),
      };
    });
  }, [
    gradingResults,
    extractedStudentAnswers,
    selectedExam,
    stableLabelForIndex,
  ]);

  const activeStep: StepId = !selectedExam
    ? 1
    : extractedStudentAnswers.length === 0
      ? 1
      : isGrading
        ? 3
        : gradingResults
          ? 4
          : 2;

  const handleStudentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setStudentFile(file);
      setIsExtracting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (selectedExam?.questions) {
          formData.append(
            "examQuestions",
            JSON.stringify(
              selectedExam.questions.map((q: any, i: number) => ({
                id: i + 1,
                label: stableLabelForIndex(i),
                text: q.content,
              }))
            )
          );
        }
        const res = await fetch("/api/extract-student", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.status === 429) {
          setCooldown(30);
          alert(
            "تم تجاوز حد الطلبات. انتظر 30 ثانية ثم أعد المحاولة."
          );
        } else if (!res.ok || data.error) {
          alert(data.error || "فشل استخراج ورقة الطالب.");
        } else if (!Array.isArray(data)) {
          alert("استجابة غير صالحة من الخادم.");
        } else {
          const enriched = data.map((a: any) => {
            const qNumInput = String(a.questionNumber).trim();
            let bestMatchIdx = -1;

            if (selectedExam?.questions) {
              bestMatchIdx = selectedExam.questions.findIndex(
                (q: any, i: number) =>
                  stableLabelForIndex(i) === qNumInput ||
                  String(i + 1) === qNumInput
              );
            }

            if (bestMatchIdx === -1 && /^\d+(\.\d+)?$/.test(qNumInput)) {
              const parsed = Math.floor(parseFloat(qNumInput));
              const qi = parsed - 1;
              if (qi >= 0 && qi < (selectedExam?.questions?.length || 0)) {
                bestMatchIdx = qi;
              }
            }

            const qi =
              bestMatchIdx !== -1
                ? bestMatchIdx
                : Number(a.questionNumber) - 1;

            return {
              ...a,
              questionNumber:
                bestMatchIdx !== -1 ? bestMatchIdx + 1 : a.questionNumber,
              displayLabel: stableLabelForIndex(qi >= 0 ? Math.floor(qi) : 0),
            };
          });
          setExtractedStudentAnswers(enriched);
        }
      } catch {
        alert("فشل الاتصال بالخادم.");
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleReExtract = async (qNum: number) => {
    if (!studentFile) return;
    setReExtractingNum(qNum);
    try {
      const qData = extractedStudentAnswers.find(
        (a: any) => a.questionNumber === qNum
      );
      const formData = new FormData();
      formData.append("file", studentFile);
      formData.append("targetQuestionNumber", qNum.toString());
      formData.append("targetQuestionText", qData?.questionText || "");
      formData.append("targetQuestionLabel", qData?.displayLabel || "");
      const res = await fetch("/api/extract-student", {
        method: "POST",
        body: formData,
      });
      if (res.status === 429) {
        setCooldown(30);
        return;
      }
      const data = await res.json();
      const index = extractedStudentAnswers.findIndex(
        (a) => a.questionNumber === qNum
      );
      if (index !== -1) updateStudentAnswer(index, data.studentAnswer);
    } catch {
      alert("فشل إعادة الاستخراج للسؤال " + qNum);
    } finally {
      setReExtractingNum(null);
    }
  };

  const handleUpdateAnswerFromResults = (qNum: number, text: string) => {
    updateStudentAnswerByQuestionNumber(qNum, text);
  };

  const executeGrading = async () => {
    if (!canReRunGrading) {
      alert("ليس لديك صلاحية تشغيل أو إعادة التصحيح.");
      return;
    }
    if (!examPreviewAcknowledged) {
      alert("يرجى فتح «معاينة الاختبار» وتأكيد المراجعة قبل التصحيح.");
      return;
    }
    if (!extractedStudentAnswers?.length) {
      alert("لا توجد إجابات مستخرجة للتصحيح.");
      return;
    }
    setIsGrading(true);
    try {
      const keyPointsData = selectedExam.questions.map((q: any, i: number) => ({
        question: q.content,
        questionNumber: i + 1,
        displayLabel: stableLabelForIndex(i),
        teacherNote: q.teacherNote || "",
        modelAnswer: q.modelAnswer || q.content,
        questionMaxPoints: typeof q.points === "number" ? q.points : 1,
        keyPoints: (q.keyPoints || []).map((kp: any) => ({
          point: kp.point,
          maxWeight: kp.grade,
        })),
      }));
      const payload = {
        studentAnswers: extractedStudentAnswers,
        keyPointsData,
        examTotalGrade: selectedExam.totalGrade ?? undefined,
        referenceMaterialsText: "لم يتم تمرير ملازم إضافية لهذا الاختبار.",
      };
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) {
        setCooldown(30);
        alert("حد الطلبات — انتظر 30 ثانية.");
      } else {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(
            typeof data?.error === "string"
              ? data.error
              : "فشل التصحيح. حاول مرة أخرى."
          );
        } else if (!Array.isArray(data?.breakdown)) {
          alert("استجابة التصحيح غير صالحة (لا يوجد تفصيل).");
        } else {
          setGradingResults(data);
        }
      }
    } finally {
      setIsGrading(false);
    }
  };

  const handleApprove = async () => {
    if (!canApproveExam) {
      alert("ليس لديك صلاحية اعتماد نماذج الاختبارات.");
      return;
    }
    try {
      const res = await fetch("/api/exams/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: selectedExam.id, status: "APPROVED" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "فشل الاعتماد.");
        return;
      }
      alert("تم اعتماد نموذج الإجابة.");
      fetchPendingExams();
      setSelectedExam(null);
      router.replace("/committee/queue", { scroll: false });
    } catch {
      alert("فشل الاعتماد.");
    }
  };

  const openRejectModal = () => {
    if (!canApproveExam) {
      alert("ليس لديك صلاحية رفض نماذج الاختبارات.");
      return;
    }
    setRejectFeedback("");
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    const trimmed = rejectFeedback.trim();
    if (!trimmed) {
      alert("اكتب سبب الرفض أو ملاحظات للمعلم.");
      return;
    }
    if (!selectedExam) return;
    setRejectSubmitting(true);
    try {
      const res = await fetch("/api/exams/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExam.id,
          status: "REJECTED",
          feedback: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "فشل الرفض.");
        return;
      }
      setRejectModalOpen(false);
      setRejectFeedback("");
      alert("تم الرفض وإعادة الطلب للمدرس.");
      fetchPendingExams();
      setSelectedExam(null);
      router.replace("/committee/queue", { scroll: false });
    } catch {
      alert("فشل الرفض.");
    } finally {
      setRejectSubmitting(false);
    }
  };

  const steps: { id: StepId; label: string }[] = [
    { id: 1, label: "رفع ورقة الطالب" },
    { id: 2, label: "مراجعة الاستخراج" },
    { id: 3, label: "التصحيح" },
    { id: 4, label: "اعتماد اللجنة" },
  ];

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-2 text-right">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
          قائمة المراجعة والتقييم
        </h1>
        <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
          راجع الطلبات المعلقة، ثم ارفع ورقة الطالب، راجع الاستخراج، شغّل التصحيح، ثم اعتماد أو رفض النموذج.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* قائمة الطلبات — على اليمين في RTL */}
        <aside className="lg:col-span-4">
          <div className="sticky top-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="text-xs font-black text-slate-600 dark:text-zinc-300">
                الطلبات المعلقة
              </span>
              <Badge
                variant="secondary"
                className="h-6 min-w-[1.5rem] rounded-full px-2 font-black"
              >
                {pendingExams.length}
              </Badge>
            </div>
            <div className="max-h-[min(70vh,560px)] space-y-2 overflow-y-auto p-3">
              {pendingExams.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center text-slate-400">
                  <AlertCircle className="mb-2 h-10 w-10 opacity-40" />
                  <p className="text-xs font-bold">لا توجد طلبات</p>
                </div>
              ) : (
                pendingExams.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => handleExamClick(exam)}
                    className={`w-full rounded-xl border p-4 text-right transition-all ${
                      selectedExam?.id === exam.id
                        ? "border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-500/20 dark:bg-indigo-950/40"
                        : "border-slate-100 bg-white hover:border-slate-200 dark:border-zinc-800 dark:bg-zinc-950"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-black leading-snug text-slate-900 dark:text-white">
                        {exam.title}
                      </h3>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] font-black"
                      >
                        {exam.type === "FINAL" ? "نهائي" : "مرحلي"}
                      </Badge>
                    </div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <User className="h-3.5 w-3.5" />
                      {exam.teacher?.name || "مدرس"}
                    </p>
                    <div className="flex items-center gap-3 border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-400 dark:border-zinc-800">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {exam.questions?.length ?? 0} أسئلة
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        {formatScore2(exam.totalGrade)} درجة
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* اللوحة الرئيسية */}
        <section className="lg:col-span-8">
          <div className="min-h-[520px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            {!selectedExam ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
                  <SplitSquareHorizontal className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="mb-2 text-lg font-black text-slate-900 dark:text-white">
                  اختر طلباً من القائمة
                </h3>
                <p className="max-w-sm text-sm font-medium text-slate-500">
                  اضغط على أحد الطلبات المعلقة لعرض التفاصيل وبدء المراجعة.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* شريط العنوان + اعتماد/رفض — ثابت في أعلى اللوحة */}
                <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 text-right">
                      <h2 className="text-lg font-black leading-tight text-slate-900 dark:text-white sm:text-xl">
                        {selectedExam.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {selectedExam.id.slice(0, 8)}
                        </Badge>
                        <Badge className="bg-indigo-100 text-[10px] font-black text-indigo-800 dark:bg-indigo-500/30 dark:text-indigo-200">
                          {selectedExam.type === "FINAL"
                            ? "نهائي"
                            : "مرحلي"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 rounded-xl font-black"
                      onClick={() => setExamPreviewOpen(true)}
                    >
                      <Eye className="ml-1.5 h-4 w-4" />
                      معاينة الاختبار
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canApproveExam}
                      title={
                        !canApproveExam
                          ? "لا تملك صلاحية الرفض"
                          : undefined
                      }
                      className="h-10 rounded-xl border-rose-200 font-black text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 disabled:opacity-50"
                      onClick={openRejectModal}
                    >
                      <XCircle className="ml-1.5 h-4 w-4" />
                      رفض النموذج
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canApproveExam}
                      title={
                        !canApproveExam
                          ? "لا تملك صلاحية الاعتماد"
                          : undefined
                      }
                      className="h-10 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                      onClick={handleApprove}
                    >
                      <ShieldCheck className="ml-1.5 h-4 w-4" />
                      اعتماد النموذج
                    </Button>
                  </div>
                </div>

                {/* مؤشر الخطوات */}
                <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {steps.map((s, i) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-[11px] font-bold"
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                            activeStep > s.id
                              ? "bg-emerald-600 text-white"
                              : activeStep === s.id
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-200 text-slate-500 dark:bg-zinc-700"
                          }`}
                        >
                          {activeStep > s.id ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          ) : (
                            s.id
                          )}
                        </span>
                        <span
                          className={
                            activeStep === s.id
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-slate-500"
                          }
                        >
                          {s.label}
                        </span>
                        {i < steps.length - 1 && (
                          <span className="mx-1 text-slate-300">←</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-8 p-5 sm:p-6">
                  {!examPreviewAcknowledged && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-right text-sm font-bold text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                      قبل رفع ورقة الطالب أو تشغيل التصحيح: افتح{" "}
                      <button
                        type="button"
                        className="font-black text-indigo-700 underline underline-offset-2 dark:text-indigo-300"
                        onClick={() => setExamPreviewOpen(true)}
                      >
                        معاينة الاختبار
                      </button>{" "}
                      ثم أكّد أنك راجعت النموذج وملاحظات المعلم.
                    </div>
                  )}

                  {examPreviewOpen && selectedExam && (
                    <div
                      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"
                      role="dialog"
                      aria-modal="true"
                    >
                      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
                        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-zinc-800">
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            معاينة نموذج الاختبار وملاحظات المعلم
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="font-black"
                            onClick={() => setExamPreviewOpen(false)}
                          >
                            إغلاق
                          </Button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-right space-y-5">
                          <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                            {selectedExam.title}
                          </p>
                          {(selectedExam.questions || []).map(
                            (q: any, qi: number) => (
                              <div
                                key={q.id || qi}
                                className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
                              >
                                <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                                  {getQuestionDisplayLabel(
                                    { displayLabel: stableLabelForIndex(qi) },
                                    qi
                                  )}
                                </p>
                                <p className="mt-2 text-sm font-black leading-relaxed text-slate-900 dark:text-white">
                                  {q.content}
                                </p>
                                {q.modelAnswer && (
                                  <p className="mt-2 text-xs font-medium italic text-slate-600 dark:text-zinc-400 border-r-2 border-indigo-200 pr-2">
                                    {q.modelAnswer}
                                  </p>
                                )}
                                {q.teacherNote?.trim() && (
                                  <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs font-bold text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                                    <span className="font-black">
                                      ملاحظة المعلم للتصحيح:{" "}
                                    </span>
                                    {q.teacherNote}
                                  </div>
                                )}
                                <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-zinc-400">
                                  {(q.keyPoints || []).map(
                                    (kp: any, ki: number) => (
                                      <li key={kp.id || ki}>
                                        • {kp.point}{" "}
                                        <span className="tabular-nums text-emerald-600">
                                          ({kp.grade})
                                        </span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )
                          )}
                        </div>
                        <div className="border-t border-slate-100 p-4 dark:border-zinc-800">
                          <Button
                            type="button"
                            className="h-11 w-full rounded-xl bg-indigo-600 font-black text-white hover:bg-indigo-700"
                            onClick={() => {
                              setExamPreviewAcknowledged(true);
                              setExamPreviewOpen(false);
                            }}
                          >
                            تمت المعاينة — متابعة رفع ورقة الطالب / التصحيح
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {extractedStudentAnswers.length === 0 && !gradingResults && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 dark:border-zinc-700 dark:bg-zinc-900/30"
                    >
                      <div className="mx-auto max-w-lg text-center">
                        <ListChecks className="mx-auto mb-3 h-10 w-10 text-indigo-500" />
                        <h3 className="mb-2 text-base font-black text-slate-900 dark:text-white">
                          رفع ورقة إجابة الطالب
                        </h3>
                        <p className="mb-6 text-sm font-medium text-slate-600 dark:text-zinc-400">
                          PDF أو صورة — يُستخدم نفس إعداد استخراج Gemini الحالي لديك.
                        </p>
                        <label
                          className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-slate-200 bg-white p-10 transition-colors dark:border-zinc-700 dark:bg-zinc-950 ${
                            examPreviewAcknowledged
                              ? "hover:border-indigo-300 hover:bg-indigo-50/30"
                              : "cursor-not-allowed opacity-50"
                          }`}
                        >
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={handleStudentUpload}
                            disabled={
                              isExtracting ||
                              cooldown > 0 ||
                              !examPreviewAcknowledged
                            }
                          />
                          {cooldown > 0 ? (
                            <div className="flex flex-col items-center gap-2 text-rose-600">
                              <Clock className="h-10 w-10" />
                              <span className="font-black">
                                انتظر {cooldown} ث
                              </span>
                            </div>
                          ) : isExtracting ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                              <span className="font-black text-indigo-700">
                                جارٍ الاستخراج...
                              </span>
                            </div>
                          ) : (
                            <>
                              <UploadCloud className="mb-3 h-12 w-12 text-indigo-500" />
                              <span className="font-black text-slate-800 dark:text-white">
                                اضغط للاختيار أو اسحب الملف هنا
                              </span>
                            </>
                          )}
                        </label>
                      </div>
                    </motion.div>
                  )}

                  {extractedStudentAnswers.length > 0 &&
                    !gradingResults &&
                    !isGrading && (
                    <div className="space-y-6">
                      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <div className="text-right text-sm">
                          <p className="font-black text-emerald-900 dark:text-emerald-100">
                            اكتمل استخراج إجابات الطالب
                          </p>
                        </div>
                      </div>

                      <ExtractionVerificationView
                        onReExtract={handleReExtract}
                        isReExtracting={reExtractingNum}
                        cooldown={cooldown}
                        readOnly={!canEditExtract}
                      />

                      <Button
                        type="button"
                        onClick={executeGrading}
                        disabled={
                          cooldown > 0 ||
                          !canReRunGrading ||
                          !examPreviewAcknowledged
                        }
                        title={
                          !canReRunGrading
                            ? "لا تملك صلاحية بدء التصحيح"
                            : undefined
                        }
                        className="h-12 w-full max-w-md mx-auto flex rounded-xl bg-indigo-600 font-black text-white shadow-md hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {cooldown > 0 ? (
                          <>
                            <Clock className="ml-2 h-5 w-5" />
                            انتظر {cooldown} ث
                          </>
                        ) : (
                          <>بدأ التصحيح</>
                        )}
                      </Button>
                    </div>
                  )}

                  {(isGrading || gradingResults) && (
                    <GradingResultsView
                      isLoading={isGrading}
                      results={gradingDisplayResults}
                      totalScore={gradingResults?.totalScore || 0}
                      maxScore={selectedExam.totalGrade}
                      editable={canEditExtract}
                      allowRegrade={canReRunGrading}
                      regrading={isGrading}
                      onUpdateStudentAnswer={handleUpdateAnswerFromResults}
                      onRegrade={executeGrading}
                    />
                  )}

                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {rejectModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
            <h3
              id="reject-dialog-title"
              className="text-lg font-black text-slate-900 dark:text-white"
            >
              رفض نموذج الاختبار
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              اكتب ملاحظات واضحة للمعلم (سبب الرفض أو المطلوب تعديله). تُحفظ مع
              الاختبار وتظهر في المستودع وفي التنبيه.
            </p>
            <textarea
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              rows={6}
              className="mt-4 w-full resize-y rounded-xl border-2 border-slate-200 bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="مثال: يرجى مطابقة سلم النقاط مع الملحق ب…"
              dir="rtl"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl font-black"
                onClick={() => setRejectModalOpen(false)}
                disabled={rejectSubmitting}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl font-black"
                onClick={confirmReject}
                disabled={rejectSubmitting}
              >
                {rejectSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "تأكيد الرفض"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommitteeQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-4 p-24">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-sm font-bold text-muted-foreground">
            جارٍ تحميل قائمة المراجعة…
          </p>
        </div>
      }
    >
      <CommitteeQueuePageContent />
    </Suspense>
  );
}
