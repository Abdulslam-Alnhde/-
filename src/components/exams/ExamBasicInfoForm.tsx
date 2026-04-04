"use client";

import { useExamStore } from "@/store/useExamStore";
import { defaultTotalGradeForType } from "@/lib/exam-type-defaults";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";

export function ExamBasicInfoForm() {
  const { examDetails, setExamDetails, setStep } = useExamStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  return (
    <div className="bg-card border-2 rounded-2xl p-6 md:p-8 shadow-lg shadow-zinc-500/10 w-full max-w-2xl mx-auto mt-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-12 -mt-12" />
      
      <div className="text-center mb-6 relative z-10">
        <div className="bg-primary/10 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary shadow-inner">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-xl md:text-2xl font-black text-foreground">الخطوة الأولى: تفاصيل الاختبار</h2>
        <p className="text-muted-foreground mt-2 text-xs font-bold opacity-70 leading-relaxed">
          معلومات أساسية قبل استخراج المحاور والنموذج الإرشادي.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-[2px] text-muted-foreground opacity-60 flex items-center gap-2">
             اسم الاختبار / المادة <span className="text-destructive">*</span>
          </label>
          <input 
            required
            type="text" 
            placeholder="مثال: هيكلة البيانات - الاختبار النصفي ٢٠٢٤"
            className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
            value={examDetails.title}
            onChange={(e) => setExamDetails({ title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[2px] text-muted-foreground opacity-60">تاريخ الانعقاد <span className="text-destructive">*</span></label>
            <input 
              required
              type="date" 
              className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm transition-all"
              value={examDetails.date}
              onChange={(e) => setExamDetails({ date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[2px] text-muted-foreground opacity-60">
              الدرجة الكلية (مرجعية) <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input 
                required
                type="number" 
                min="1"
                placeholder="00"
                className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm transition-all text-center md:text-right"
                value={examDetails.totalGrade}
                onChange={(e) => setExamDetails({ totalGrade: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-black uppercase tracking-widest pointer-events-none">
                درجة
              </span>
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
              عند الاعتماد، تُحسب <span className="font-black text-foreground">الدرجة الكلية المحفوظة</span> تلقائياً من مجموع درجات الأسئلة (مجموع محاور كل سؤال) لتطابق النموذج.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-[2px] text-muted-foreground opacity-60">نوع التقييم الأكاديمي</label>
          <select 
            className="w-full px-4 py-3 bg-background border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm appearance-none cursor-pointer transition-all"
            value={examDetails.type}
            onChange={(e) => {
              const type = e.target.value;
              setExamDetails({
                type,
                totalGrade: defaultTotalGradeForType(type),
              });
            }}
          >
            <option value="QUIZ">اختبار قصير / تقييم سريع</option>
            <option value="MIDTERM">اختبار نصفي (Midterm)</option>
            <option value="FINAL">اختبار نهائي (Final Exam)</option>
          </select>
        </div>

        <Button type="submit" className="w-full h-11 text-sm font-black mt-2 gap-2 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 group">
          حفظ ومتابعة الاستخراج <ArrowRight className="w-5 h-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
        </Button>
      </form>
    </div>
  );
}
