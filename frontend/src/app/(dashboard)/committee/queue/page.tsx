"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "@/common/lib/motion";
const GradingResultsView = dynamic(
  () =>
    import("@/modules/exams/components/GradingResultsView").then(
      (m) => m.GradingResultsView
    ),
  { ssr: false }
);
const ExtractionVerificationView = dynamic(
  () =>
    import("@/modules/exams/components/ExtractionVerificationView").then(
      (m) => m.ExtractionVerificationView
    ),
  { ssr: false }
);
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
import { Button } from "@/common/ui/button";
import { Badge } from "@/common/ui/badge";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { useExamStore } from "@/modules/exams/store/useExamStore";
import { hasPermission, PERMISSION_KEYS } from "@/common/lib/permissions";
import { getQuestionDisplayLabel } from "@/modules/exams/lib/question-labels";
import { formatScore2 } from "@/modules/exams/lib/score-format";

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
    void (async () => {
      try {
        const [meRes, examsRes] = await Promise.all([
          fetch("/api/users/me"),
          fetch("/api/exams/pending"),
        ]);
        const [meData, examsData] = await Promise.all([
          meRes.json(),
          examsRes.json(),
        ]);
        setMe({
          role: meData?.role ?? "COMMITTEE",
          permissionKeys: Array.isArray(meData?.permissionKeys)
            ? meData.permissionKeys
            : [],
        });
        setPendingExams(Array.isArray(examsData) ? examsData : []);
        setPendingLoaded(true);
      } catch {
        setMe({ role: "COMMITTEE", permissionKeys: [] });
        setPendingExams([]);
        setPendingLoaded(true);
      }
    })();
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

  // (me + pendingExams) are loaded together above to reduce latency

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
                questionType: q.type === "OBJECTIVE" ? "OBJECTIVE" : "RUBRIC",
                modelAnswer: q.modelAnswer || "",
                questionMaxPoints: typeof q.points === "number" ? q.points : undefined,
                keyPoints: Array.isArray(q.keyPoints)
                  ? q.keyPoints.map((kp: any) => kp.point || "").filter(Boolean)
                  : [],
                teacherNote: q.teacherNote || "",
              }))
            )
          );
        }
        const res = await fetch("/api/services/extract-student", {
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
        } else if (
          data.length > 0 &&
          data.every((item: any) => !String(item?.studentAnswer || "").trim())
        ) {
          setExtractedStudentAnswers([]);
          alert(
            "لم يتم العثور على إجابات طالب واضحة في الملف المرفوع. تأكد أنك رفعت ورقة الطالب التي تحتوي على الإجابات، أو ارفع نسخة أوضح."
          );
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
      const qIndex = qNum - 1;
      const examQ = selectedExam?.questions?.[qIndex];
      const formData = new FormData();
      formData.append("file", studentFile);
      formData.append("targetQuestionNumber", qNum.toString());
      formData.append("targetQuestionText", qData?.questionText || "");
      formData.append("targetQuestionLabel", qData?.displayLabel || "");
      if (examQ && selectedExam?.questions) {
        formData.append(
          "examQuestions",
          JSON.stringify(
            selectedExam.questions.map((q: any, i: number) => ({
              id: i + 1,
              label: stableLabelForIndex(i),
              text: q.content,
              questionType: q.type === "OBJECTIVE" ? "OBJECTIVE" : "RUBRIC",
              modelAnswer: q.modelAnswer || "",
              questionMaxPoints: typeof q.points === "number" ? q.points : undefined,
              keyPoints: Array.isArray(q.keyPoints)
                ? q.keyPoints.map((kp: any) => kp.point || "").filter(Boolean)
                : [],
              teacherNote: q.teacherNote || "",
            }))
          )
        );
      }
      const res = await fetch("/api/services/extract-student", {
        method: "POST",
        body: formData,
      });
      if (res.status === 429) {
        setCooldown(30);
        alert("تم تجاوز حد الطلبات. انتظر 30 ثانية ثم أعد المحاولة.");
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "فشل إعادة استخراج السؤال.");
        return;
      }
      const index = extractedStudentAnswers.findIndex(
        (a) => a.questionNumber === qNum
      );
      if (index !== -1 && typeof data?.studentAnswer === "string") {
        updateStudentAnswer(index, data.studentAnswer);
      } else {
        alert("استجابة غير صالحة من الخادم.");
      }
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
    if (!extractedStudentAnswers?.length) {
      alert("لا توجد إجابات مستخرجة للتصحيح.");
      return;
    }
    setIsGrading(true);
    setGradingResults(null); // Clear old results to show the core loader and signify a fresh start
    try {
      const keyPointsData = selectedExam.questions.map((q: any, i: number) => ({
        question: q.content,
        questionNumber: i + 1,
        displayLabel: stableLabelForIndex(i),
        questionType: q.type === "OBJECTIVE" ? "OBJECTIVE" : "RUBRIC",
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
      const res = await fetch("/api/services/grading", {
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
    <div className="page-content space-y-8">
      {/* Page header */}
      <PageHeader
        eyebrow="لجنة المراجعة"
        title="قائمة المراجعة والتقييم"
        subtitle="راجع الطلبات المعلقة، ثم ارفع ورقة الطالب، راجع الاستخراج، شغّل التصحيح، ثم اعتماد أو رفض النموذج."
      />

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:items-start">
        {/* قائمة الطلبات — على اليمين في RTL */}
        <aside className="lg:col-span-4">
          <div className="sticky top-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card dark:shadow-black/20">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                الطلبات المعلقة
              </span>
              <Badge
                variant="secondary"
                className="h-6 min-w-[1.5rem] rounded-full px-2.5 font-black"
              >
                {pendingExams.length}
              </Badge>
            </div>
            <div className="max-h-[min(70vh,560px)] space-y-2 overflow-y-auto p-3">
              {pendingExams.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-center text-muted-foreground">
                  <AlertCircle className="mb-3 h-10 w-10 opacity-30" />
                  <p className="text-xs font-bold">لا توجد طلبات معلقة</p>
                </div>
              ) : (
                pendingExams.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => handleExamClick(exam)}
                    className={`w-full rounded-xl border p-4 text-right transition-all duration-150 ${
                      selectedExam?.id === exam.id
                        ? "border-primary/50 bg-primary/5 shadow-md ring-2 ring-primary/15"
                        : "border-border bg-white hover:border-brand-teal/30 hover:shadow-sm dark:bg-card"
                    }`}
                  >
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-black leading-snug text-foreground">
                        {exam.title}
                      </h3>
                      <Badge
                        variant="outline"
                        className="shrink-0 rounded-lg text-[10px] font-black"
                      >
                        {exam.type === "FINAL" ? "نهائي" : "مرحلي"}
                      </Badge>
                    </div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {exam.teacher?.name || "مدرس"}
                    </p>
                    <div className="flex items-center gap-3 border-t border-border pt-2.5 text-[10px] font-bold text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {exam.questions?.length ?? 0} أسئلة
                      </span>
                      <span className="text-muted-foreground">·</span>
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
          <div className="min-h-[520px] overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card dark:shadow-black/20">
            {!selectedExam ? (
              <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <SplitSquareHorizontal className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-xl font-black text-foreground">
                  اختر طلباً من القائمة
                </h3>
                <p className="max-w-sm text-sm font-medium text-muted-foreground">
                  اضغط على أحد الطلبات المعلقة لعرض التفاصيل وبدء المراجعة.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* شريط العنوان + اعتماد/رفض */}
                <div className="flex flex-col gap-4 border-b border-border bg-muted/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 text-right">
                      <h2 className="text-lg font-black leading-tight text-foreground sm:text-xl">
                        {selectedExam.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-lg font-mono text-[10px]">
                          {selectedExam.id.slice(0, 8)}
                        </Badge>
                        <Badge className="rounded-lg bg-brand-teal/10 text-[10px] font-black text-brand-teal">
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
                      className="h-9 rounded-xl font-black"
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
                      className="h-9 rounded-xl border-[#D32F2F]/30 font-black text-[#D32F2F] hover:bg-[#FFEBEB] disabled:opacity-50"
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
                      className="h-9 rounded-xl bg-[#00A99D] font-black text-white hover:bg-[#008F84] disabled:opacity-50"
                      onClick={handleApprove}
                    >
                      <ShieldCheck className="ml-1.5 h-4 w-4" />
                      اعتماد النموذج
                    </Button>
                  </div>
                </div>

                {/* مؤشر الخطوات */}
                <div className="border-b border-border px-5 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {steps.map((s, i) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-xs font-bold"
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-colors ${
                            activeStep > s.id
                              ? "bg-[#00A99D] text-white"
                              : activeStep === s.id
                                ? "bg-primary text-white shadow-sm shadow-primary/30"
                                : "bg-muted text-muted-foreground"
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
                              ? "font-black text-primary"
                              : activeStep > s.id
                                ? "text-brand-teal"
                                : "text-muted-foreground"
                          }
                        >
                          {s.label}
                        </span>
                        {i < steps.length - 1 && (
                          <span className="mx-0.5 text-muted-foreground">←</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-7 p-5 sm:p-7">
                  {!examPreviewAcknowledged && (
                    <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-right text-sm font-bold text-brand-orange">
                      قبل رفع ورقة الطالب أو تشغيل التصحيح: افتح{" "}
                      <button
                        type="button"
                        className="font-black text-brand-teal underline underline-offset-2"
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
                      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#EEEEEE] bg-white shadow-2xl dark:border-[#1E3330] dark:bg-[#1A2E2D]">
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                          <h3 className="text-base font-black text-foreground">
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
                          <p className="text-sm font-bold text-foreground">
                            {selectedExam.title}
                          </p>
                          {(selectedExam.questions || []).map(
                            (q: any, qi: number) => (
                              <div
                                key={q.id || qi}
                                className="rounded-xl border border-border bg-muted/40 p-4"
                              >
                                <p className="text-[10px] font-black uppercase text-brand-teal">
                                  {getQuestionDisplayLabel(
                                    { displayLabel: stableLabelForIndex(qi) },
                                    qi
                                  )}
                                </p>
                                <p className="mt-2 text-sm font-black leading-relaxed text-foreground">
                                  {q.content}
                                </p>
                                {q.modelAnswer && (
                                  <p className="mt-2 text-xs font-medium italic text-muted-foreground border-r-2 border-brand-teal/30 pr-2">
                                    {q.modelAnswer}
                                  </p>
                                )}
                                {q.teacherNote?.trim() && (
                                  <div className="mt-3 rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-3 py-2 text-xs font-bold text-brand-orange">
                                    <span className="font-black">
                                      ملاحظة المعلم للتصحيح:{" "}
                                    </span>
                                    {q.teacherNote}
                                  </div>
                                )}
                                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                                  {(q.keyPoints || []).map(
                                    (kp: any, ki: number) => (
                                      <li key={kp.id || ki}>
                                        • {kp.point}{" "}
                                        <span className="tabular-nums text-brand-teal">
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
                        <div className="border-t border-border p-4">
                          <Button
                            type="button"
                            className="h-11 w-full rounded-xl bg-brand-teal font-black text-white hover:bg-brand-teal/90"
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
                      className="rounded-2xl border border-dashed border-border bg-muted/40 p-8"
                    >
                      <div className="mx-auto max-w-lg text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal/10">
                          <ListChecks className="h-7 w-7 text-brand-teal" />
                        </div>
                        <h3 className="mb-2 text-lg font-black text-foreground">
                          رفع ورقة إجابة الطالب
                        </h3>
                        <p className="mb-7 text-sm font-medium text-muted-foreground">
                          PDF أو صورة — يُستخدم الآن مسار استخراج API البعيد للورقة.
                        </p>
                        <label
                          className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-border bg-white p-10 transition-all duration-200 dark:bg-[#162422] hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                        >
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={handleStudentUpload}
                            disabled={
                              isExtracting ||
                              cooldown > 0
                            }
                          />
                          {cooldown > 0 ? (
                            <div className="flex flex-col items-center gap-2 text-[#D32F2F]">
                              <Clock className="h-10 w-10" />
                              <span className="font-black">
                                انتظر {cooldown} ث
                              </span>
                            </div>
                          ) : isExtracting ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="h-10 w-10 animate-spin text-brand-teal" />
                              <span className="font-black text-brand-teal">
                                جارٍ الاستخراج...
                              </span>
                            </div>
                          ) : (
                            <>
                              <UploadCloud className="mb-3 h-12 w-12 text-brand-teal" />
                              <span className="font-black text-foreground">
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
                      <div className="flex items-start gap-3 rounded-xl border border-[#00A99D]/30 bg-[#E6F7F6] px-4 py-3.5 dark:bg-[#0D2422] dark:border-[#00C4B7]/30">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00A99D]" />
                        <div className="text-right text-sm">
                          <p className="font-black text-foreground">
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
                          !canReRunGrading
                        }
                        title={
                          !canReRunGrading
                            ? "لا تملك صلاحية بدء التصحيح"
                            : undefined
                        }
                        className="mx-auto flex h-12 w-full max-w-md rounded-xl bg-primary font-black text-primary-foreground shadow-md shadow-primary/20 hover:bg-[#008F84] disabled:opacity-60"
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
          <div className="w-full max-w-lg rounded-2xl border border-[#EEEEEE] bg-white p-6 shadow-xl dark:border-[#1E3330] dark:bg-[#1A2E2D]">
            <h3
              id="reject-dialog-title"
              className="text-lg font-black text-foreground"
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
              className="mt-4 w-full resize-y rounded-xl border-2 border-border bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#D32F2F]/20 dark:bg-[#162422] dark:text-[#C8DEDD]"
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
    <Suspense fallback={<PageLoading message="جارٍ تحميل قائمة المراجعة…" />}>
      <CommitteeQueuePageContent />
    </Suspense>
  );
}
