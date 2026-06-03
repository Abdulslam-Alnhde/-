"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  ArrowRight,
  UploadCloud,
  FileType,
  CheckCircle,
  Loader2,
  FileText,
  X,
  FileSearch,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import { useExamStore } from "@/modules/exams/store/useExamStore";
import {
  validateExamStructure,
  type StructureValidation,
} from "@/modules/exams/lib/exam-structure";
import { motion, AnimatePresence } from "@/common/lib/motion";

function isPdf(f: File) {
  const n = f.name?.toLowerCase() || "";
  return f.type === "application/pdf" || n.endsWith(".pdf");
}

function isImage(f: File) {
  return f.type.startsWith("image/");
}

export function ExamUploadForm() {
  const { setExtractedQuestions, setExamDetails, setStep, examStructure } =
    useExamStore();

  const [examFiles, setExamFiles] = useState<File[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [structureError, setStructureError] =
    useState<StructureValidation | null>(null);
  const [structureOverride, setStructureOverride] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<any>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null
  );
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  useEffect(() => {
    if (!preview) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [preview]);

  const openPreview = (file: File) => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    const url = URL.createObjectURL(file);
    setPreview({ url, name: file.name });
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleExamFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setExamFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setError(null);
    }
  };

  const removeExamFile = (index: number) => {
    setExamFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setError(null);
    }
  };

  const removeRefFile = (indexToRemove: number) => {
    setReferenceFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleExtraction = async () => {
    if (examFiles.length === 0) return;

    setIsExtracting(true);
    setError(null);
    setStructureError(null);

    try {
      const formData = new FormData();
      examFiles.forEach((file) => {
        formData.append("examFiles", file);
      });

      referenceFiles.forEach((file) => {
        formData.append("referenceFiles", file);
      });

      // الهيكل المُعلَن من المعلم — يُمرَّر للـ AI كقالب متوقَّع
      formData.append("expectedStructure", JSON.stringify(examStructure));

      const response = await axios.post("/api/services/extract-teacher", formData, {
        timeout: 600000,
      });

      if (
        response.data &&
        response.data.questions &&
        Array.isArray(response.data.questions)
      ) {
        // التحقق من تطابق نتيجة الاستخراج مع الهيكل المُعلَن
        const validation = validateExamStructure(
          examStructure,
          response.data.questions
        );
        if (!validation.ok && !structureOverride) {
          setStructureError(validation);
          setPendingQuestions(response.data);
          return;
        }

        setStructureError(null);
        setStructureOverride(false);
        setPendingQuestions(null);
        setExtractedQuestions(response.data.questions);
        if (response.data.title && typeof response.data.title === "string") {
          setExamDetails({ aiSuggestedTitle: response.data.title.trim() });
        }
        setStep(3);
      } else {
        throw new Error("استجابة الخادم غير صالحة: لم يتم العثور على الأسئلة.");
      }
    } catch (err: unknown) {
      console.error(err);
      const ax = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      const isAxiosTimeout =
        typeof ax.message === "string" &&
        ax.message.toLowerCase().includes("timeout");
      setError(
        ax.response?.data?.error ||
          (isAxiosTimeout
            ? "انتهت مهلة الاتصال أثناء الاستخراج. إذا كان الملف كبيراً، جرّب تقسيمه أو انتظر ثم أعد المحاولة."
            : null) ||
          "حدث خطأ أثناء الاتصال بخدمة الاستخراج. تحقق من الإعدادات أو حاول لاحقاً."
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const filePreviewPortal =
    portalReady &&
    preview &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePreview();
        }}
      >
        <div
          className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <p className="truncate text-sm font-black">{preview.name}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 font-black"
              onClick={closePreview}
            >
              إغلاق
            </Button>
          </div>
          <div className="min-h-[50vh] flex-1 overflow-auto bg-muted/30">
            {preview.name.toLowerCase().endsWith(".pdf") ||
            preview.url.includes("pdf") ? (
              <iframe
                title={preview.name}
                src={preview.url}
                className="h-[min(75vh,720px)] w-full border-0"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.name}
                className="mx-auto max-h-[75vh] w-auto object-contain"
              />
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="bg-card w-full max-w-4xl mx-auto mt-4 space-y-6">
      {filePreviewPortal}

      <div className="text-center mb-4 space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          رفع ملفات الاختبار
        </h2>
      </div>

      <div className="w-full max-w-4xl mx-auto flex justify-start">
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 rounded-2xl border-brand-teal/30 bg-white px-4 text-sm font-black text-brand-teal-dark shadow-sm shadow-brand-teal/10 transition hover:border-brand-teal hover:bg-brand-teal-light hover:text-brand-teal-dark"
          onClick={() => setStep(1)}
          disabled={isExtracting}
        >
          <ArrowRight className="h-4 w-4" />
          العودة للبيانات الأساسية
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col hover:shadow-lg transition-all duration-300 group">
          <div className="w-full text-center border-b border-muted pb-4 mb-5">
            <h3 className="text-sm font-semibold text-primary">ورقة الاختبار</h3>
          </div>

          <label
            className={`relative border-2 border-dashed rounded-2xl p-6 w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group ${
              examFiles.length > 0
                ? "border-[#00A99D] bg-[#E6F7F6]/30"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              type="file"
              multiple
              className="hidden"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
              onChange={handleExamFileChange}
              disabled={isExtracting}
            />

            <AnimatePresence mode="wait">
              {examFiles.length > 0 ? (
                <motion.div
                  key="uploaded"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex w-full flex-col gap-2 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="bg-[#00A99D] p-2 rounded-xl text-white shadow">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-black text-foreground">
                      {examFiles.length} ملف(ات)
                    </span>
                  </div>
                  <div className="max-h-32 w-full space-y-1.5 overflow-y-auto text-right">
                    {examFiles.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#EEEEEE] bg-white/80 px-2 py-1.5 text-[11px] font-bold dark:border-[#1E3330] dark:bg-card/80"
                      >
                        <span className="truncate min-w-0">{f.name}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              openPreview(f);
                            }}
                            className="rounded-md p-1.5 text-primary hover:bg-primary/10"
                            title="معاينة"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              removeExamFile(i);
                            }}
                            className="text-[#D32F2F] hover:text-[#B71C1C] p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center text-center space-y-4"
                >
                  <div className="bg-primary/10 p-4 rounded-2xl text-primary">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-medium">انقر للرفع</h4>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </label>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col hover:shadow-lg transition-all duration-300 group">
          <div className="w-full text-center border-b border-muted pb-4 mb-5">
            <h3 className="text-sm font-semibold text-brand-teal">الملازم المرجعية</h3>
          </div>

          <label
            className={`relative border-2 border-dashed rounded-2xl p-6 w-full flex flex-col items-center justify-center cursor-pointer transition-all border-brand-teal/30 hover:bg-brand-teal/10 overflow-hidden min-h-[140px] ${
              referenceFiles.length > 0
                ? "border-brand-teal bg-brand-teal/10"
                : ""
            }`}
          >
            <input
              type="file"
              multiple
              className="hidden"
              accept="application/pdf,text/plain,.txt,image/*"
              onChange={handleRefFileChange}
              disabled={isExtracting}
            />

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="bg-brand-teal/10 p-4 rounded-2xl text-brand-teal">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-medium text-muted-foreground">انقر للرفع</h4>
              </div>
            </div>
          </label>

          {referenceFiles.length > 0 && (
            <div className="mt-4 w-full space-y-2 max-h-36 overflow-y-auto pr-1">
              {referenceFiles.map((f, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 p-2 text-[11px] font-bold bg-muted/30 rounded-xl border"
                >
                  <span className="truncate min-w-0">{f.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {(isPdf(f) || isImage(f)) && (
                      <button
                        type="button"
                        onClick={() => openPreview(f)}
                        className="rounded-md p-1 text-primary hover:bg-primary/10"
                        title="معاينة"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRefFile(i)}
                      className="text-muted-foreground hover:text-[#D32F2F] p-1"
                    >
                      <X className="w-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 w-full max-w-xl mx-auto">
        {structureError && !structureError.ok && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 w-full rounded-2xl border-2 border-[#D32F2F]/25 bg-[#FFEBEB] p-4 text-right dark:bg-[#2A1616] dark:border-[#EF5350]/30"
          >
            <div className="flex items-center gap-2 text-[#D32F2F] dark:text-[#EF5350]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-black">
                نتيجة الاستخراج لا تطابق الهيكل المُعلَن
              </h4>
            </div>
            <p className="mt-1.5 text-xs font-medium text-[#D32F2F]/90 dark:text-[#EF5350]/90">
              نتيجة الاستخراج لا تتطابق مع الهيكل المحدد. يمكنك تعديل الهيكل
              وإعادة الاستخراج، أو المتابعة بالنتيجة الحالية.
            </p>

            <div className="mt-3 overflow-hidden rounded-xl border border-[#D32F2F]/20 bg-white dark:bg-[#1A2E2D]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D32F2F]/15 bg-[#D32F2F]/[0.06] font-bold text-[#D32F2F] dark:text-[#EF5350]">
                    <th className="px-3 py-2 text-right">البند</th>
                    <th className="px-3 py-2 text-center">حدّدت</th>
                    <th className="px-3 py-2 text-center">استُخرج</th>
                  </tr>
                </thead>
                <tbody>
                  {structureError.mismatches.map((m) => (
                    <tr
                      key={m.label}
                      className="border-b border-[#D32F2F]/10 last:border-0"
                    >
                      <td className="px-3 py-2 font-bold text-foreground">
                        {m.label}
                      </td>
                      <td className="px-3 py-2 text-center font-black tabular-nums text-foreground">
                        {m.declared}
                      </td>
                      <td className="px-3 py-2 text-center font-black tabular-nums text-[#D32F2F] dark:text-[#EF5350]">
                        {m.found}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full border-[#D32F2F]/30 text-[#D32F2F] hover:bg-[#D32F2F]/10 dark:text-[#EF5350] dark:border-[#EF5350]/30 dark:hover:bg-[#EF5350]/10 font-bold text-xs"
              onClick={() => {
                if (pendingQuestions?.questions) {
                  setExtractedQuestions(pendingQuestions.questions);
                  if (pendingQuestions.title) {
                    setExamDetails({ aiSuggestedTitle: pendingQuestions.title.trim() });
                  }
                  setStructureError(null);
                  setStructureOverride(false);
                  setPendingQuestions(null);
                  setStep(3);
                }
              }}
            >
              متابعة بالنتيجة الحالية رغم الاختلاف
            </Button>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 w-full p-4 bg-[#FFEBEB] border-2 border-[#D32F2F]/20 text-[#D32F2F] text-sm rounded-xl text-center font-black flex items-center justify-center gap-2 dark:bg-[#2A1616] dark:border-[#EF5350]/30 dark:text-[#EF5350]"
          >
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </motion.div>
        )}
        <Button
          className="w-full gap-3 bg-primary hover:bg-[#008F84] text-primary-foreground h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/15 active:scale-[0.98] transition-all"
          onClick={handleExtraction}
          disabled={examFiles.length === 0 || isExtracting}
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جارِ الاستخراج...
            </>
          ) : (
            <>
              <FileType className="w-5 h-5" />
                بدء استخراج المحتوى
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
