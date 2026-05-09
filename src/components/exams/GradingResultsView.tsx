"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  Pencil,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatScore2 } from "@/lib/score-format";

interface GradingResult {
  questionNumber: number;
  displayLabel?: string;
  questionText: string;
  studentAnswer: string;
  modelAnswer: string;
  pointsEarned: number;
  reasoning: string;
  evaluatedKeyPoints: {
    point: string;
    earnedGrade: number;
    matched: boolean;
  }[];
  missingPoints?: string[];
}

interface GradingResultsViewProps {
  results: GradingResult[];
  totalScore: number;
  maxScore: number;
  isLoading?: boolean;
  /** تعديل نص إجابة الطالب */
  editable?: boolean;
  /** إظهار زر إعادة التصحيح — يُفصل عن التعديل عند تقييد الصلاحيات */
  allowRegrade?: boolean;
  regrading?: boolean;
  onUpdateStudentAnswer?: (questionNumber: number, text: string) => void;
  onRegrade?: () => void;
}

export function GradingResultsView({
  results,
  totalScore,
  maxScore,
  isLoading,
  editable = false,
  allowRegrade,
  regrading = false,
  onUpdateStudentAnswer,
  onRegrade,
}: GradingResultsViewProps) {
  const showRegrade =
    (allowRegrade !== undefined ? allowRegrade : editable) && onRegrade;
  const [editingQ, setEditingQ] = useState<number | null>(null);

  const hasRows = Array.isArray(results) && results.length > 0;

  /** أول تصحيح: لا توجد نتائج بعد — عرض تحميل واضح بدل مساحة بيضاء */
  if (isLoading && !hasRows) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20 dark:border-zinc-700 dark:bg-zinc-900/30">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
        <p className="text-sm font-black text-slate-600 dark:text-zinc-400">
          جارٍ التصحيح...
        </p>
      </div>
    );
  }

  if (!isLoading && !hasRows) {
    return null;
  }

  const pct =
    maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <div
      className={`space-y-4 animate-in fade-in duration-300 ${
        isLoading && hasRows ? "opacity-[0.72]" : ""
      }`}
      aria-busy={isLoading && hasRows ? true : undefined}
    >
      {/* شريط النتيجة — مدمج */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-slate-200 dark:text-zinc-700"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={
                  maxScore > 0
                    ? 251.2 - (251.2 * totalScore) / maxScore
                    : 251.2
                }
                strokeLinecap="round"
                className="text-emerald-500 transition-[stroke-dashoffset] duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-400">
              {pct}%
            </span>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              نتيجة التصحيح
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              الدرجة = مجموع أسئلة الورقة
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
            {formatScore2(totalScore)}
          </span>
          <span className="text-sm font-bold text-slate-400">
            {" "}
            / {formatScore2(maxScore)}
          </span>
        </div>
      </div>

      {showRegrade && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            عدّل النصوص أو احذف سؤالاً ثم أعد التصحيح لتطبيق التغييرات.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-amber-300 font-black text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100"
            onClick={onRegrade}
            disabled={regrading}
          >
            {regrading ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ml-1 h-4 w-4" />
            )}
            إعادة التصحيح
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {results.map((result, idx) => (
          <Card
            key={`${result.questionNumber}-${idx}`}
            className="overflow-hidden border border-slate-200/90 shadow-sm dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex min-w-0 flex-1 items-start gap-2 text-right">
                <span
                  className="flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-1.5 text-xs font-black text-white sm:text-sm"
                  title={`ترقيم الورقة: ${result.displayLabel ?? result.questionNumber}`}
                >
                  {result.displayLabel ?? result.questionNumber}
                </span>
                <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900 dark:text-zinc-100">
                  {result.questionText}
                </p>
              </div>
              <Badge className="shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                {formatScore2(result.pointsEarned)} درجة
              </Badge>
            </div>

            <CardContent className="space-y-3 p-3 sm:p-4">
              {/* صف مقارنة مدمج */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                      <MessageSquare className="h-3 w-3" />
                      إجابة الطالب
                    </span>
                    {editable && (
                      <button
                        type="button"
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                        onClick={() =>
                          setEditingQ(
                            editingQ === result.questionNumber
                              ? null
                              : result.questionNumber
                          )
                        }
                      >
                        <Pencil className="inline h-3 w-3" />{" "}
                        {editingQ === result.questionNumber
                          ? "إغلاق"
                          : "تعديل"}
                      </button>
                    )}
                  </div>
                  {editable &&
                  onUpdateStudentAnswer &&
                  editingQ === result.questionNumber ? (
                    <textarea
                      dir="auto"
                      className="min-h-[72px] w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-medium leading-relaxed text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      value={result.studentAnswer || ""}
                      onChange={(e) =>
                        onUpdateStudentAnswer(
                          result.questionNumber,
                          e.target.value
                        )
                      }
                    />
                  ) : (
                    <p className="rounded-lg border border-blue-100 bg-blue-50/50 p-2 text-sm font-medium leading-relaxed text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                      {result.studentAnswer?.trim()
                        ? result.studentAnswer
                        : "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    النموذج المرجعي
                  </span>
                  <p className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2 text-sm font-medium leading-relaxed text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                    {result.modelAnswer?.trim()
                      ? result.modelAnswer
                      : "—"}
                  </p>
                </div>
              </div>

              {/* نقاط تفصيلية — شبكة مدمجة */}
              {result.evaluatedKeyPoints &&
                result.evaluatedKeyPoints.length > 0 && (
                  <div className="space-y-2 border-t border-dashed border-slate-200 pt-3 dark:border-zinc-700">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      الفروع والدرجات
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {result.evaluatedKeyPoints.map((kp, kIdx) => (
                        <div
                          key={kIdx}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-right dark:border-zinc-800 dark:bg-zinc-900/40"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {kp.matched ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span
                              className={`min-w-0 text-xs leading-snug ${
                                kp.matched
                                  ? "font-bold text-slate-800 dark:text-zinc-200"
                                  : "text-slate-500 line-through decoration-slate-300"
                              }`}
                            >
                              {kp.point}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-black tabular-nums text-slate-700 dark:text-zinc-300">
                            +{formatScore2(kp.earnedGrade)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* سبب الدرجة — نص أصغر */}
              <div className="flex gap-2 border-t border-slate-100 pt-3 text-right dark:border-zinc-800">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                    التعليل
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-zinc-200">
                    {result.reasoning}
                  </p>
                  {result.missingPoints && result.missingPoints.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-rose-700 dark:text-rose-300">
                      {result.missingPoints.map((mp, mi) => (
                        <li key={mi} className="flex items-start gap-1">
                          <span className="text-rose-400">•</span>
                          {mp}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
