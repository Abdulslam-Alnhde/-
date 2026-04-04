"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
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
import { Button } from "@/components/ui/button";
import { useExamStore } from "@/store/useExamStore";
import { motion, AnimatePresence } from "@/lib/motion";

function isPdf(f: File) {
  const n = f.name?.toLowerCase() || "";
  return f.type === "application/pdf" || n.endsWith(".pdf");
}

function isImage(f: File) {
  return f.type.startsWith("image/");
}

export function ExamUploadForm() {
  const { setExtractedQuestions, setExamDetails, setStep } = useExamStore();

  const [examFiles, setExamFiles] = useState<File[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    try {
      const formData = new FormData();
      examFiles.forEach((file) => {
        formData.append("examFiles", file);
      });

      referenceFiles.forEach((file) => {
        formData.append("referenceFiles", file);
      });

      const response = await axios.post("/api/extract", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (
        response.data &&
        response.data.questions &&
        Array.isArray(response.data.questions)
      ) {
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
      const ax = err as { response?: { data?: { error?: string } } };
      setError(
        ax.response?.data?.error ||
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
        <div className="inline-flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
          <FileSearch className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-wider">
            استخراج من الورقة
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-black text-foreground">
          الخطوة الثانية: استخراج إجابات الطالب
        </h2>
        <p className="text-muted-foreground text-xs font-bold opacity-70 max-w-2xl mx-auto leading-relaxed">
          ارفع PDF أو صوراً لورقة الاختبار. يمكن معاينة كل ملف قبل التشغيل. الملازم اختيارية.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="border-2 rounded-2xl p-5 shadow-sm bg-background flex flex-col hover:shadow-md transition-all">
          <div className="w-full text-center border-b pb-4 mb-4">
            <h3 className="text-base font-black text-primary">ورقة الاختبار</h3>
            <p className="text-[10px] font-black text-muted-foreground mt-1 uppercase tracking-wider opacity-60">
              PDF أو صور — معاينة قبل الاستخراج
            </p>
          </div>

          <label
            className={`relative border-2 border-dashed rounded-2xl p-6 w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group ${
              examFiles.length > 0
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-zinc-200 dark:border-zinc-800 hover:border-primary/50 hover:bg-muted/30"
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
                    <div className="bg-emerald-500 p-2 rounded-xl text-white shadow">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-black text-emerald-800 dark:text-emerald-100">
                      {examFiles.length} ملف(ات)
                    </span>
                  </div>
                  <div className="max-h-32 w-full space-y-1.5 overflow-y-auto text-right">
                    {examFiles.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200/80 bg-white/80 px-2 py-1.5 text-[11px] font-bold dark:bg-zinc-900/50"
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
                            className="text-rose-500 hover:text-rose-700 p-1"
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
                    <h4 className="text-sm font-black">اختر المستند</h4>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider opacity-60">
                      انقر للرفع
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </label>
        </div>

        <div className="border-2 rounded-2xl p-5 shadow-sm bg-background flex flex-col hover:shadow-md transition-all">
          <div className="w-full text-center border-b pb-4 mb-4">
            <h3 className="text-base font-black text-indigo-500">الملازم المرجعية</h3>
            <p className="text-[10px] font-black text-muted-foreground mt-1 uppercase tracking-wider opacity-60">
              اختياري
            </p>
          </div>

          <label
            className={`relative border-2 border-dashed rounded-2xl p-6 w-full flex flex-col items-center justify-center cursor-pointer transition-all border-indigo-200/50 hover:bg-indigo-50/50 overflow-hidden min-h-[140px] ${
              referenceFiles.length > 0
                ? "border-indigo-400 bg-indigo-50/10"
                : ""
            }`}
          >
            <input
              type="file"
              multiple
              className="hidden"
              accept="application/pdf,.doc,.docx,.txt,image/*"
              onChange={handleRefFileChange}
              disabled={isExtracting}
            />

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-2xl text-indigo-500">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-black">سياق إضافي</h4>
                <p className="text-[10px] font-bold text-indigo-400 opacity-70 uppercase">
                  ملازم أو ملاحظات
                </p>
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
                      className="text-zinc-400 hover:text-rose-500 p-1"
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
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 w-full p-4 bg-rose-500/10 border-2 border-rose-500/20 text-rose-600 text-sm rounded-xl text-center font-black flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </motion.div>
        )}
        <Button
          className="w-full gap-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 h-12 text-base font-black rounded-xl shadow-lg shadow-indigo-500/25 active:scale-[0.99]"
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
