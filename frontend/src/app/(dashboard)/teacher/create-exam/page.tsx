"use client";

import { Suspense } from "react";
import { useExamStore } from "@/store/useExamStore";
import { motion, AnimatePresence } from "@/lib/motion";
import { Check, Info, FileUp, Sparkles, Loader2 } from "lucide-react";
import { ExamBasicInfoForm } from "@/components/exams/ExamBasicInfoForm";
import { ExamUploadForm } from "@/components/exams/ExamUploadForm";
import { ExamReviewForm } from "@/components/exams/ExamReviewForm";
import { CreateExamEditLoader } from "@/components/exams/CreateExamLoader";

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
      <header className="mb-8 text-right">
        <h1 className="text-2xl font-bold text-foreground">اختبار جديد</h1>
      </header>

      {/* STEPS HEADER */}
      <div className="w-full max-w-2xl mx-auto mb-12">
        <div className="relative flex items-center justify-between">
          {/* Progress track */}
          <div className="absolute left-0 top-[22px] -translate-y-1/2 w-full h-1 bg-border rounded-full pointer-events-none -z-10" />
          <div
            className="absolute left-0 top-[22px] -translate-y-1/2 h-1 bg-primary rounded-full pointer-events-none -z-10 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
          
          {STEPS.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            const canGoBack = s.num < step;
            
            return (
              <div 
                key={s.num}
                className="flex flex-col items-center gap-3 relative z-10"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (canGoBack) setStep(s.num);
                  }}
                  disabled={!canGoBack}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all duration-300 font-medium ${
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/25"
                      : isCurrent
                        ? "bg-white border-primary text-primary shadow-lg shadow-primary/15 ring-4 ring-primary/10 dark:bg-card"
                        : "bg-white border-border text-muted-foreground dark:bg-card"
                  } ${canGoBack ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
                >
                  {isCompleted ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <s.icon className="w-5 h-5" />}
                </button>
                <span 
                  className={`text-xs whitespace-nowrap font-medium transition-colors duration-300 ${
                    isCurrent 
                      ? "text-primary" 
                      : isCompleted 
                        ? "text-foreground" 
                        : "text-muted-foreground opacity-50"
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
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">جارٍ التحميل…</p>
        </div>
      }
    >
      <CreateExamWizardInner />
    </Suspense>
  );
}
