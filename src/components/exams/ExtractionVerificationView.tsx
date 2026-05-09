"use client";

import {
  RotateCw,
  AlertCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "@/lib/motion";
import { useExamStore } from "@/store/useExamStore";

interface ExtractionVerificationViewProps {
  onReExtract: (questionNumber: number) => Promise<void>;
  isReExtracting: number | null; // Currently re-extracting this question number
  cooldown?: number;
  /** عند true: عرض فقط بدون تعديل نص الإجابة ولا إعادة الاستخراج */
  readOnly?: boolean;
}

export function ExtractionVerificationView({
  onReExtract,
  isReExtracting,
  cooldown = 0,
  readOnly = false,
}: ExtractionVerificationViewProps) {
  const { extractedStudentAnswers, updateStudentAnswer } = useExamStore();

  if (!extractedStudentAnswers || extractedStudentAnswers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
        <AlertCircle className="mb-4 h-12 w-12 text-slate-300" />
        <h3 className="mb-1 text-lg font-black text-foreground">لا توجد بيانات مستخرجة</h3>
        <p className="text-sm font-medium text-muted-foreground">يرجى رفع ورقة الطالب لبدء التحليل.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-right">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
            مراجعة الاستخراج
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
            {readOnly
              ? "عرض فقط — ليس لديك صلاحية تعديل الاستخراج أو إعادة استخراج الأسئلة."
              : "راجع النصوص وعدّلها قبل تشغيل التصحيح."}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit shrink-0 font-black"
        >
          {extractedStudentAnswers.length} سؤال
        </Badge>
      </div>

      <div className="space-y-4">
        {extractedStudentAnswers.map((ans, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-indigo-200 dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-1 text-sm font-black text-white sm:text-lg"
                    title={`سؤال ${ans.displayLabel ?? ans.questionNumber}`}
                  >
                    {ans.displayLabel ?? ans.questionNumber}
                  </div>
                  <div className="min-w-0 space-y-1 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">نص السؤال</p>
                    <CardTitle className="line-clamp-2 text-base font-black leading-snug text-foreground">
                      {ans.questionText}
                    </CardTitle>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Badge variant="outline" className={`rounded-lg px-2.5 py-0.5 text-[10px] font-black ${
                    ans.studentAnswer && ans.studentAnswer.trim() !== "" 
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700" 
                    : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}>
                    {ans.studentAnswer && ans.studentAnswer.trim() !== "" ? "تم الاستخراج" : "لا إجابة"}
                  </Badge>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReExtract(ans.questionNumber)}
                    disabled={
                      readOnly ||
                      isReExtracting === ans.questionNumber ||
                      cooldown > 0
                    }
                    className={`h-9 gap-1.5 rounded-lg px-3 text-xs font-bold ${
                      cooldown > 0 ? "border-rose-200 bg-rose-50 text-rose-600" : ""
                    }`}
                  >
                    {isReExtracting === ans.questionNumber ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <RotateCw className="w-4 h-4 text-primary" />
                    )}
                    {cooldown > 0 ? `انتظر (${cooldown}ث)` : "إعادة استخراج"}
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3 p-4 sm:p-5">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  <MessageSquare className="h-3.5 w-3.5" />{" "}
                  {readOnly
                    ? "إجابة الطالب (عرض فقط)"
                    : "إجابة الطالب (قابلة للتعديل)"}
                </label>
                
                <textarea
                  value={ans.studentAnswer || ""}
                  onChange={(e) => updateStudentAnswer(idx, e.target.value)}
                  readOnly={readOnly}
                  disabled={readOnly}
                  dir="auto"
                  spellCheck={false}
                  className={`min-h-[100px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-start text-sm font-medium leading-relaxed text-slate-900 outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 ${
                    readOnly ? "cursor-not-allowed opacity-80" : ""
                  }`}
                  placeholder="اكتب أو صحح إجابة الطالب هنا..."
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
