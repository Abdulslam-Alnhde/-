"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useExamStore } from "@/store/useExamStore";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import {
  normalizeKeyPointsToCap,
  questionTotalPoints,
  scaleAllQuestionsToTotal,
} from "@/lib/exam-scoring";
import { Button } from "@/components/ui/button";
import { motion } from "@/lib/motion";
import {
  Save,
  Plus,
  Trash2,
  Edit3,
  ClipboardList,
  Loader2,
  StickyNote,
  Eye,
} from "lucide-react";

export function ExamReviewForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    examDetails,
    extractedQuestions,
    editingExamId,
    setEditingExamId,
    setExtractedQuestions,
    setStep,
    updateKeyPointGrade,
    updateKeyPointText,
    addKeyPoint,
    removeKeyPoint,
    updateTeacherNote,
    updateQuestionMaxPointsAndDistribute,
  } = useExamStore();

  const [noteOpen, setNoteOpen] = useState<Record<number, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMounted, setPreviewMounted] = useState(false);

  useEffect(() => {
    setPreviewMounted(true);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [previewOpen]);

  const questionsPayload = extractedQuestions.map((q) => {
    if (q.questionType === "OBJECTIVE") {
      return { ...q, keyPoints: [] };
    }
    const cap =
      typeof q.questionMaxPoints === "number" &&
      Number.isFinite(q.questionMaxPoints) &&
      q.questionMaxPoints > 0
        ? q.questionMaxPoints
        : null;
    const keyPoints =
      cap != null ? normalizeKeyPointsToCap(q.keyPoints, cap) : q.keyPoints;
    return { ...q, keyPoints };
  });

  const sumQuestionPoints = questionsPayload.reduce((s, q) => {
    return s + questionTotalPoints(q);
  }, 0);

  const maxRef = Number(examDetails.totalGrade) || 0;
  const overExamCap = maxRef > 0 && sumQuestionPoints > maxRef + 1e-6;

  const handleFinalize = async () => {
    if (overExamCap) {
      alert(
        `مجموع درجات الأسئلة (${sumQuestionPoints.toFixed(2)}) يتجاوز الدرجة الكلية المرجعية (${maxRef}). عدّل المحاور أو الدرجة الكلية.`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        title: examDetails.title,
        date: examDetails.date,
        type: examDetails.type,
        totalGrade: examDetails.totalGrade,
        declaredMaxGrade: examDetails.totalGrade,
        extractedQuestions: questionsPayload,
      };

      if (editingExamId) {
        const { data } = await axios.patch(`/api/exams/${editingExamId}`, payload);
        if (data.success) {
          alert("تم تحديث الاختبار وإعادة إرساله للجنة بنجاح!");
          setEditingExamId(null);
          router.push("/teacher/exams");
        }
      } else {
        const { data } = await axios.post("/api/exams/finalize", payload);
        if (data.success) {
          alert("تم حفظ الاختبار وإرساله للجنة بنجاح!");
          router.push("/teacher");
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert("فشل في حفظ الاختبار: " + (err?.response?.data?.error ?? ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewPortal =
    previewMounted &&
    previewOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-preview-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreviewOpen(false);
        }}
      >
        <div
          className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <h3 id="exam-preview-title" className="text-sm font-black">
              معاينة الاختبار كاملة
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-black"
              onClick={() => setPreviewOpen(false)}
            >
              إغلاق
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 text-right space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                العنوان والنوع
              </p>
              <p className="font-black text-lg mt-1">{examDetails.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {examDetails.type} - درجة مرجعية: {examDetails.totalGrade}
              </p>
            </div>
            {questionsPayload.map((q, qi) => (
              <div
                key={qi}
                className="rounded-xl border bg-muted/20 p-4 space-y-2 text-sm"
              >
                <p className="text-[10px] font-black text-primary">
                  سؤال {getQuestionDisplayLabel(q, qi)}
                </p>
                <p className="font-bold leading-relaxed">{q.question}</p>
                <p className="text-xs text-muted-foreground italic border-r-2 border-primary/30 pr-2">
                  {q.modelAnswer}
                </p>
                {q.keyPoints.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    {q.keyPoints.map((kp, ki) => (
                      <li key={ki}>
                        {kp.point}{" "}
                        <span className="tabular-nums text-brand-teal">
                          ({kp.defaultGrade})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs font-bold text-brand-teal">
                    درجة السؤال: {questionTotalPoints(q)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 space-y-6 pb-12">
      {previewPortal}

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-xl text-primary">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-foreground">
              الخطوة الثالثة: المراجعة
            </h2>
            <p className="text-muted-foreground mt-1 text-xs font-bold opacity-70">
              راجع المحاور والدرجات. عيّن "درجة السؤال" لتوزيعها تلقائيًا على المحاور في الأسئلة المقالية.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-2 font-black rounded-xl"
            onClick={() => setPreviewOpen(true)}
            disabled={!extractedQuestions?.length}
          >
            <Eye className="w-4 h-4" />
            معاينة الاختبار
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={
              isSubmitting ||
              !Array.isArray(extractedQuestions) ||
              extractedQuestions.length === 0 ||
              overExamCap
            }
            className="h-10 px-6 gap-2 shadow-lg shadow-brand-teal/20 bg-[#00A99D] hover:bg-[#008F84] font-black text-sm rounded-xl text-white shrink-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSubmitting
              ? "جارٍ الحفظ..."
              : editingExamId
                ? "إعادة الإرسال للجنة"
                : "اعتماد وحفظ النموذج"}
          </Button>
        </div>
      </div>

      {overExamCap && (
        <div
          className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm font-bold text-brand-orange flex flex-wrap items-center justify-between gap-4"
          role="status"
        >
          <div>
            مجموع درجات الأسئلة ({sumQuestionPoints.toFixed(2)}) أعلى من الدرجة
            الكلية ({maxRef}). خفّض درجات المحاور أو راجع الدرجة المرجعية في
            الخطوة الأولى.
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 bg-brand-orange/20 border-brand-orange/30 hover:bg-brand-orange/30 text-brand-orange font-black rounded-lg gap-2"
            onClick={() => {
              const scaled = scaleAllQuestionsToTotal(extractedQuestions, maxRef);
              setExtractedQuestions(scaled);
            }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            ضبط الدرجات تلقائيًا لتناسب السقف ({maxRef})
          </Button>
        </div>
      )}

      <div className="rounded-xl border-2 border-primary/15 bg-primary/5 px-4 py-3 text-right">
        <p className="text-[10px] font-black uppercase tracking-[2px] text-primary/70">
          العنوان المعتمد (الخطوة الأولى)
        </p>
        {editingExamId && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-black text-brand-orange">
              وضع التعديل: إعادة إرسال اختبار مرفوض سابقًا.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px] font-black"
              onClick={() => setStep(2)}
            >
              رفع ملفات جديدة وإعادة الاستخراج
            </Button>
          </div>
        )}
        <h3 className="mt-2 text-lg font-black text-foreground">
          {examDetails.title?.trim()
            ? examDetails.title
            : "- لم يُحدد عنوانًا"}
        </h3>
        {examDetails.aiSuggestedTitle?.trim() &&
          examDetails.aiSuggestedTitle.trim() !==
            examDetails.title?.trim() && (
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              <span className="font-black text-foreground/80">
                اقتراح من المستند (مرجعي فقط):{" "}
              </span>
              {examDetails.aiSuggestedTitle}
            </p>
          )}
      </div>

      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] font-bold text-right flex flex-wrap justify-between gap-2">
        <span>
          مجموع درجات الأسئلة:{" "}
          <span className="tabular-nums font-black">{sumQuestionPoints.toFixed(2)}</span>
        </span>
        <span>
          سقف مرجعي من الخطوة 1:{" "}
          <span className="tabular-nums font-black">{maxRef || "-"}</span>
        </span>
      </div>

      <div className="space-y-5">
        {Array.isArray(extractedQuestions) && extractedQuestions.map((q, qIndex) => {
          const isObjective = q.questionType === "OBJECTIVE";
          const shownTotal = questionTotalPoints(q);
          const cap =
            typeof q.questionMaxPoints === "number" &&
            Number.isFinite(q.questionMaxPoints) &&
            q.questionMaxPoints > 0
              ? q.questionMaxPoints
              : null;
          const over = !isObjective && cap != null && shownTotal > cap + 1e-6;

          return (
            <div key={qIndex} className="bg-card border-2 rounded-2xl p-5 md:p-6 shadow-sm transition-all hover:shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-muted/30 rounded-bl-full -mr-8 -mt-8 group-hover:bg-primary/5 transition-colors" />

              <div className="border-b pb-4 mb-4 relative z-10">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-primary font-black uppercase tracking-[3px] text-[10px] block opacity-60">
                    السؤال{" "}
                    <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-sm font-black text-primary">
                      {getQuestionDisplayLabel(q, qIndex)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg text-[11px] font-black"
                    onClick={() =>
                      setNoteOpen((o) => ({
                        ...o,
                        [qIndex]: !o[qIndex],
                      }))
                    }
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    {noteOpen[qIndex] ? "إخفاء الملاحظة" : "ملاحظة للتصحيح الآلي"}
                  </Button>
                </div>
                {noteOpen[qIndex] && (
                  <div className="mb-4 rounded-xl border border-brand-orange/30 bg-brand-orange/10 p-3">
                    <p className="mb-2 text-[10px] font-bold text-brand-orange">
                      تعليمات للنظام عند التصحيح (اختياري): معايير إضافية، تركيز على جزء معين، أو قواعد خاصة بهذا السؤال.
                    </p>
                    <textarea
                      value={q.teacherNote || ""}
                      onChange={(e) => updateTeacherNote(qIndex, e.target.value)}
                      dir="rtl"
                      rows={3}
                      className="w-full rounded-lg border border-brand-orange/30 bg-white p-2 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-orange/20 dark:bg-[#162422] dark:text-[#C8DEDD] dark:border-brand-orange/40"
                      placeholder="مثال: اعتمد التعريف من المحاضرة 4؛ لا تخصم على الصياغة إن كان المنطق صحيحًا..."
                    />
                  </div>
                )}
                <h3 className="text-base md:text-lg font-black text-foreground mb-3 leading-relaxed">{q.question}</h3>
                <div className="bg-muted/30 p-3 rounded-xl border border-dashed border-border text-sm font-bold leading-relaxed italic text-muted-foreground relative">
                  <span className="absolute -top-3 right-4 px-2 py-0.5 bg-white border border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:bg-card">
                    الإجابة النموذجية
                  </span>
                  "{q.modelAnswer}"
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-black text-[10px] uppercase tracking-wider text-muted-foreground opacity-60 flex items-center gap-2">
                    <Edit3 className="w-3.5 h-3.5 text-brand-teal" />
                    {isObjective
                      ? "درجة السؤال الموضوعي"
                      : "محاور التقييم (Key Points)"}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="rounded-lg bg-muted px-2 py-1 text-foreground">
                      {isObjective ? "درجة السؤال" : "مجموع المحاور"}:{" "}
                      <span className="tabular-nums">{shownTotal.toFixed(2)}</span>
                    </span>
                    <label className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2 py-1 text-primary">
                      <span className="text-[10px] opacity-80">درجة السؤال:</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-14 rounded border border-primary/20 bg-white px-1 py-0.5 text-center text-[11px] font-black tabular-nums outline-none focus:ring-1 focus:ring-primary dark:bg-[#162422] dark:text-[#C8DEDD]"
                        value={cap ?? ""}
                        placeholder="-"
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateQuestionMaxPointsAndDistribute(
                              qIndex,
                              undefined
                            );
                            return;
                          }
                          const n = parseFloat(v);
                          updateQuestionMaxPointsAndDistribute(
                            qIndex,
                            Number.isFinite(n) && n >= 0 ? n : undefined
                          );
                        }}
                      />
                    </label>
                    {over && (
                      <span
                        className="rounded-lg bg-brand-orange/10 px-2 py-1 text-brand-orange"
                        role="status"
                      >
                        التعديل مطلوب: المجموع يتجاوز درجة السؤال
                      </span>
                    )}
                  </div>
                </div>

                {isObjective ? (
                  <div className="rounded-2xl border border-[#00A99D]/20 bg-[#E6F7F6]/60 px-4 py-5 text-right text-sm font-bold text-foreground dark:bg-[#0D2422]/60 dark:border-[#00C4B7]/20">
                    هذا سؤال موضوعي، لذلك سيُصحح بدرجة مباشرة للسؤال بدون إنشاء محاور تقييم.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addKeyPoint(qIndex)}
                        className="h-9 px-4 text-xs font-black gap-2 rounded-xl border-2 hover:bg-[#E6F7F6] hover:text-[#00A99D] hover:border-[#00A99D]/30"
                      >
                        <Plus className="w-4 h-4" /> إضافة محور جديد
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {q.keyPoints.map((point, pIndex) => (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={pIndex}
                          className="flex items-start gap-4 bg-background border-2 p-3 rounded-xl shadow-sm relative group/point transition-all hover:border-primary/50"
                        >
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                              المفهوم المطلوب ذكره
                            </label>
                            <input
                              type="text"
                              value={point.point}
                              onChange={(e) =>
                                updateKeyPointText(qIndex, pIndex, e.target.value)
                              }
                              className="w-full bg-transparent border-none p-0 focus:ring-0 text-base font-bold outline-none placeholder:opacity-30"
                              placeholder="مثال: يجب ذكر تعقيد الخوارزمية (O notation)..."
                            />
                          </div>

                          <div className="w-28 shrink-0 space-y-2 border-r-2 pr-6">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                              الدرجة
                            </label>
                            <div className="flex items-center relative gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={point.defaultGrade}
                                onChange={(e) =>
                                  updateKeyPointGrade(
                                    qIndex,
                                    pIndex,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full bg-muted/30 border-2 rounded-xl px-4 py-2 text-sm font-black focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-center"
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => removeKeyPoint(qIndex, pIndex)}
                            className="absolute -right-3 -top-3 bg-[#D32F2F] text-white p-2 rounded-xl opacity-0 group-hover/point:opacity-100 transition-all flex items-center justify-center hover:scale-110 shadow-lg shadow-[#D32F2F]/30 ring-4 ring-white"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}

                      {q.keyPoints.length === 0 && (
                        <div className="text-center p-12 border-4 border-dashed rounded-[2rem] text-muted-foreground bg-muted/30">
                          <p className="font-bold text-sm">
                            لا توجد محاور تقييم حاليًا. أضف بعض النقاط لتمكين التصحيح التلقائي الدقيق.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {(!Array.isArray(extractedQuestions) || extractedQuestions.length === 0) && (
          <div className="text-center p-12 text-muted-foreground bg-muted/10 border-2 border-dashed rounded-2xl space-y-4">
            <div className="bg-muted p-6 rounded-full w-16 h-16 flex items-center justify-center mx-auto opacity-30">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-black text-foreground">لم يتم استخراج أي أسئلة بعد</p>
              <p className="text-xs font-medium">يرجى العودة للخطوة السابقة وتشغيل الاستخراج أولًا.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
