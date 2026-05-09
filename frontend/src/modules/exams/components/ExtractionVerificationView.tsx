"use client";

import {
  RotateCw,
  AlertCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/common/ui/card";
import { Badge } from "@/common/ui/badge";
import { Button } from "@/common/ui/button";
import { motion } from "@/common/lib/motion";
import { useExamStore } from "@/modules/exams/store/useExamStore";

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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-1 text-lg font-black text-foreground">لا توجد بيانات مستخرجة</h3>
        <p className="text-sm font-medium text-muted-foreground">يرجى رفع ورقة الطالب لبدء التحليل.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-right">
          <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl">
            مراجعة الاستخراج
          </h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
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
            <Card className="group overflow-hidden rounded-2xl border border-border bg-white transition-colors hover:border-brand-teal/30 dark:bg-card">
              <CardHeader className="flex flex-col gap-4 border-b border-border bg-muted/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal px-1 text-sm font-black text-white sm:text-lg"
                    title={`سؤال ${ans.displayLabel ?? ans.questionNumber}`}
                  >
                    {ans.displayLabel ?? ans.questionNumber}
                  </div>
                  <div className="min-w-0 space-y-1 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">نص السؤال</p>
                    <CardTitle className="line-clamp-2 text-base font-black leading-snug text-foreground">
                      {ans.questionText}
                    </CardTitle>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Badge variant="outline" className={`rounded-lg px-2.5 py-0.5 text-[10px] font-black ${
                    ans.studentAnswer && ans.studentAnswer.trim() !== ""
                    ? "border-[#00A99D] bg-[#E6F7F6] text-[#00A99D] dark:bg-[#0D2422] dark:text-[#00C4B7] dark:border-[#00C4B7]"
                    : "border-[#D32F2F]/40 bg-[#FFEBEB] text-[#D32F2F] dark:bg-[#2A1616] dark:text-[#EF5350] dark:border-[#EF5350]/40"
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
                      cooldown > 0 ? "border-[#D32F2F]/30 bg-[#FFEBEB] text-[#D32F2F]" : ""
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
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-brand-teal">
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
                  className={`min-h-[100px] w-full resize-y rounded-xl border border-border bg-muted/30 p-3 text-start text-sm font-medium leading-relaxed text-foreground outline-none transition-colors focus:border-brand-teal/50 focus:bg-background focus:ring-2 focus:ring-brand-teal/20 ${
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
