"use client";

import { useEffect, useState } from "react";
import {
  useExamStore,
  createEmptyStructureQuestion,
  type ExamStructureQuestion,
} from "@/modules/exams/store/useExamStore";
import {
  declaredTotalGrade,
  declaredObjectiveCount,
  declaredRubricCount,
  declaredSubPartCount,
} from "@/modules/exams/lib/exam-structure";
import { Button } from "@/common/ui/button";
import { ArrowRight, BookOpen, LayoutList, AlertCircle } from "lucide-react";

const MAX_QUESTIONS = 100;

/** يحوّل قيمة حقل رقمي إلى عدد صحيح غير سالب */
function toCount(value: string): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** يحوّل قيمة حقل الدرجة إلى رقم غير سالب (يقبل الكسور) */
function toGrade(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ExamBasicInfoForm() {
  const { examDetails, setExamDetails, examStructure, setExamStructure, setStep } =
    useExamStore();
  const [error, setError] = useState<string | null>(null);

  const questions = examStructure.questions;
  const totalGrade = declaredTotalGrade(examStructure);

  // الدرجة الكلية = مجموع درجات الأسئلة المُعلَنة
  useEffect(() => {
    setExamDetails({ totalGrade });
  }, [totalGrade, setExamDetails]);

  /** يضبط عدد الأسئلة — يضيف أسئلة افتراضية أو يقصّ القائمة */
  const setQuestionCount = (count: number) => {
    const n = Math.max(0, Math.min(MAX_QUESTIONS, Math.floor(count)));
    if (n === questions.length) return;
    if (n > questions.length) {
      const next = [...questions];
      while (next.length < n) next.push(createEmptyStructureQuestion());
      setExamStructure({ questions: next });
    } else {
      setExamStructure({ questions: questions.slice(0, n) });
    }
  };

  const updateQuestion = (
    index: number,
    patch: Partial<ExamStructureQuestion>
  ) => {
    setExamStructure({
      questions: questions.map((q, i) =>
        i === index ? { ...q, ...patch } : q
      ),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (examStructure.pageCount < 1) {
      setError("حدّد عدد صفحات الاختبار (صفحة واحدة على الأقل).");
      return;
    }
    if (questions.length < 1) {
      setError("حدّد عدد أسئلة الاختبار (سؤال واحد على الأقل).");
      return;
    }
    if (questions.some((q) => q.grade <= 0)) {
      setError("كل سؤال يجب أن تكون درجته أكبر من صفر.");
      return;
    }

    setError(null);
    setStep(2);
  };

  return (
    <div className="bg-card border-2 rounded-2xl p-6 md:p-8 shadow-lg shadow-black/8 w-full max-w-2xl mx-auto mt-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-12 -mt-12" />

      <div className="text-center mb-6 relative z-10">
        <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary">
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">تفاصيل الاختبار</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            اسم الاختبار <span className="text-destructive">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="مثال: هيكلة البيانات - الاختبار النصفي ٢٠٢٤"
            className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all shadow-sm dark:bg-[#162422] dark:text-[#C8DEDD]"
            value={examDetails.title}
            onChange={(e) => setExamDetails({ title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              تاريخ الانعقاد <span className="text-destructive">*</span>
            </label>
            <input
              required
              type="date"
              className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm transition-all"
              value={examDetails.date}
              onChange={(e) => setExamDetails({ date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              نوع الاختبار
            </label>
            <select
              className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm appearance-none cursor-pointer transition-all dark:bg-[#162422] dark:text-[#C8DEDD]"
              value={examDetails.type}
              onChange={(e) => setExamDetails({ type: e.target.value })}
            >
              <option value="QUIZ">اختبار قصير / تقييم سريع</option>
              <option value="MIDTERM">اختبار نصفي (Midterm)</option>
              <option value="FINAL">اختبار نهائي (Final Exam)</option>
            </select>
          </div>
        </div>

        {/* ── هيكل الاختبار ── */}
        <div className="rounded-2xl border-2 border-primary/15 bg-primary/[0.03] p-4 md:p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <div className="bg-primary/10 text-primary rounded-lg p-2 shrink-0">
              <LayoutList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                هيكل الاختبار
              </h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                حدّد بنية الاختبار قبل الرفع — يستخدمها النظام كقالب متوقَّع
                لمنع أخطاء الاستخراج في الاختبارات الكبيرة.
              </p>
            </div>
          </div>

          {/* الصفحات + عدد الأسئلة */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground block">
                عدد صفحات الاختبار <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                className="w-full px-3 py-2.5 bg-background border-2 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm transition-all dark:bg-[#162422] dark:text-[#C8DEDD]"
                value={examStructure.pageCount}
                onChange={(e) => {
                  const n = toCount(e.target.value);
                  setExamStructure({ pageCount: n < 1 ? 1 : n });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground block">
                عدد أسئلة الاختبار <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={MAX_QUESTIONS}
                inputMode="numeric"
                className="w-full px-3 py-2.5 bg-background border-2 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm transition-all dark:bg-[#162422] dark:text-[#C8DEDD]"
                value={questions.length}
                onChange={(e) => setQuestionCount(toCount(e.target.value))}
              />
            </div>
          </div>

          {/* بطاقات الأسئلة */}
          {questions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-primary/25 bg-background/60 px-3 py-4 text-center text-[11px] font-medium text-muted-foreground">
              حدّد عدد الأسئلة بالأعلى لتظهر تفاصيل كل سؤال.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pl-1">
              {questions.map((q, i) => (
                <QuestionRow
                  key={i}
                  index={i}
                  question={q}
                  onChange={(patch) => updateQuestion(i, patch)}
                />
              ))}
            </div>
          )}

          {/* ملخص */}
          {questions.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <SummaryChip
                label="موضوعية"
                value={declaredObjectiveCount(examStructure)}
              />
              <SummaryChip
                label="مقالية"
                value={declaredRubricCount(examStructure)}
              />
              <SummaryChip
                label="تفرعات"
                value={declaredSubPartCount(examStructure)}
              />
              <SummaryChip label="الدرجة" value={totalGrade} highlight />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-[#FFEBEB] border border-[#D32F2F]/20 px-3.5 py-2.5 text-xs font-bold text-[#D32F2F]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-sm font-medium mt-2 gap-2 rounded-xl shadow-md shadow-primary/15 transition-all active:scale-95 group"
        >
          متابعة{" "}
          <ArrowRight className="w-5 h-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
        </Button>
      </form>
    </div>
  );
}

/** صف سؤال واحد: النوع ← الدرجة ← التفرعات */
function QuestionRow({
  index,
  question,
  onChange,
}: {
  index: number;
  question: ExamStructureQuestion;
  onChange: (patch: Partial<ExamStructureQuestion>) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-border bg-background p-3 dark:bg-[#162422]">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-black text-primary">
          {index + 1}
        </span>
        <span className="text-xs font-bold text-foreground">
          السؤال {index + 1}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground block">
            النوع
          </label>
          <select
            className="w-full px-2 py-2 bg-card border-2 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary cursor-pointer transition-all dark:bg-[#1A2E2D] dark:text-[#C8DEDD]"
            value={question.type}
            onChange={(e) =>
              onChange({ type: e.target.value as ExamStructureQuestion["type"] })
            }
          >
            <option value="OBJECTIVE">موضوعي</option>
            <option value="RUBRIC">مقالي</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground block">
            الدرجة
          </label>
          <input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            className="w-full px-2 py-2 bg-card border-2 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all dark:bg-[#1A2E2D] dark:text-[#C8DEDD]"
            value={question.grade}
            onChange={(e) => onChange({ grade: toGrade(e.target.value) })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground block">
            التفرعات
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="إن وجدت"
            className="w-full px-2 py-2 bg-card border-2 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all dark:bg-[#1A2E2D] dark:text-[#C8DEDD]"
            value={question.subPartCount}
            onChange={(e) => onChange({ subPartCount: toCount(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

/** شريحة ملخص صغيرة */
function SummaryChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-xl bg-primary/10 px-2 py-2 text-center"
          : "rounded-xl bg-background/70 border border-border px-2 py-2 text-center dark:bg-[#162422]"
      }
    >
      <p
        className={
          highlight
            ? "text-base font-black tabular-nums text-primary leading-none"
            : "text-base font-black tabular-nums text-foreground leading-none"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
