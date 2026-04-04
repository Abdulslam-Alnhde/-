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
      {/* STEPS HEADER */}
      <div className="w-full max-w-3xl mx-auto mb-8">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-muted rounded-full pointer-events-none -z-10" />
          
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            
            return (
              <div 
                key={s.num}
                className="flex flex-col items-center relative z-10"
              >
                <div 
                  className={`w-11 h-11 flex flex-col items-center justify-center rounded-xl border-[3px] transition-all duration-500 font-black shadow-lg ${
                    isCompleted 
                      ? "bg-primary border-primary text-primary-foreground shadow-primary/20"
                      : isCurrent 
                        ? "bg-background border-primary text-primary shadow-primary/10 ring-8 ring-primary/10"
                        : "bg-muted border-muted-foreground/10 text-muted-foreground shadow-zinc-500/5"
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <div 
                  className={`absolute -bottom-8 text-[10px] whitespace-nowrap font-black uppercase tracking-widest transition-colors duration-500 ${
                    isCurrent || isCompleted ? "text-foreground opacity-100" : "text-muted-foreground opacity-40"
                  }`}
                >
                  {s.title}
                </div>
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
