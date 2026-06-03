"use client";

import { Suspense } from "react";
import { useExamStore } from "@/modules/exams/store/useExamStore";
import { motion, AnimatePresence } from "@/common/lib/motion";
import { Check, Info, FileUp, Sparkles } from "lucide-react";
import { ExamBasicInfoForm } from "@/modules/exams/components/ExamBasicInfoForm";
import { ExamUploadForm } from "@/modules/exams/components/ExamUploadForm";
import { ExamReviewForm } from "@/modules/exams/components/ExamReviewForm";
import { CreateExamEditLoader } from "@/modules/exams/components/CreateExamLoader";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";

function CreateExamWizardInner() {
  const { step, setStep } = useExamStore();

  const STEPS = [
    { num: 1, title: "البيانات الأساسية", icon: Info },
    { num: 2, title: "رفع الملفات والاستخراج", icon: FileUp },
    { num: 3, title: "المراجعة والاعتماد", icon: Sparkles },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      <CreateExamEditLoader />

      {/* Page title */}
      <PageHeader
        eyebrow="الأستاذ"
        title="إنشاء اختبار جديد"
        subtitle="اتبع الخطوات الثلاث لرفع الاختبار وإرساله للجنة المراجعة."
        className="mb-10"
      />

      {/* STEPS HEADER */}
      <div className="mx-auto mb-14 w-full max-w-4xl px-4">
        <div className="relative z-0 flex items-center justify-between">
          {/* Progress track */}
          <div className="pointer-events-none absolute left-0 top-8 z-0 h-2 w-full -translate-y-1/2 rounded-full bg-brand-teal-light ring-1 ring-brand-teal/10" />
          <div
            className="pointer-events-none absolute left-0 top-8 z-0 h-2 -translate-y-1/2 rounded-full bg-brand-teal shadow-sm shadow-brand-teal/20 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
          
          {STEPS.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            const canGoBack = s.num < step;
            
            return (
              <div 
                key={s.num}
                className="relative z-10 flex min-w-[160px] flex-col items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (canGoBack) setStep(s.num);
                  }}
                  disabled={!canGoBack}
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-lg font-black transition-all duration-300 ${
                    isCompleted
                      ? "border-brand-teal bg-brand-teal text-white shadow-lg shadow-brand-teal/25"
                      : isCurrent
                        ? "border-brand-teal bg-white text-brand-teal shadow-lg shadow-brand-teal/20 ring-4 ring-brand-teal/15 dark:bg-card"
                        : "border-brand-teal/15 bg-white text-muted-foreground/70 shadow-sm dark:bg-card"
                  } ${canGoBack ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
                >
                  {isCompleted ? (
                    <Check className="h-7 w-7" strokeWidth={2.75} />
                  ) : (
                    <s.icon className="h-7 w-7" strokeWidth={2.4} />
                  )}
                </button>
                <span 
                  className={`whitespace-nowrap text-[15px] font-black transition-colors duration-300 ${
                    isCurrent 
                      ? "text-brand-teal-dark" 
                      : isCompleted 
                        ? "text-foreground" 
                        : "text-muted-foreground/75"
                  }`}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP CONTENT Rendering */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex-1"
          >
            {step === 1 && <ExamBasicInfoForm />}
            {step === 2 && <ExamUploadForm />}
            {step === 3 && <ExamReviewForm />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CreateExamWizard() {
  return (
    <Suspense fallback={<PageLoading message="جارٍ التحميل…" />}>
      <CreateExamWizardInner />
    </Suspense>
  );
}
