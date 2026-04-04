"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, FileEdit, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEACHER_LINKS } from "@/lib/dashboard-links";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import {
  formatKeyPointGradeAr,
  formatQuestionPointsAr,
} from "@/lib/exam-points-display";
import { sortExamQuestionsForDisplay } from "@/lib/exam-question-order";
import { isPrimarilyEnglish } from "@/lib/text-direction";

type ExamLike = {
  id: string;
  title: string;
  type?: string | null;
  status?: string;
  committeeFeedback?: string | null;
  questions?: any[];
};

function ContentBlock({
  children,
  text,
}: {
  children: ReactNode;
  text?: string | null;
}) {
  const en = isPrimarilyEnglish(text ?? "");
  if (en) {
    return (
      <div
        dir="ltr"
        lang="en"
        className="text-left text-sm font-medium leading-relaxed tracking-normal text-foreground"
      >
        {children}
      </div>
    );
  }
  return (
    <div className="text-right text-sm font-semibold leading-relaxed text-foreground">
      {children}
    </div>
  );
}

export function TeacherExamDetailView({
  exam,
  showBackLink = true,
}: {
  exam: ExamLike;
  showBackLink?: boolean;
}) {
  const questions = sortExamQuestionsForDisplay(exam.questions ?? []);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-16">
      {showBackLink && (
        <Button variant="ghost" asChild className="-mb-1 gap-2 px-0 text-muted-foreground hover:text-foreground">
          <Link href={TEACHER_LINKS.exams}>
            <ArrowRight className="h-4 w-4 rotate-180" />
            العودة إلى المستودع
          </Link>
        </Button>
      )}

      <header className="space-y-2 border-b border-border pb-6 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          تفاصيل النموذج الامتحاني
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {exam.title}
        </h1>
        {exam.type && (
          <p className="text-sm text-muted-foreground">
            نوع الاختبار:{" "}
            <span className="font-semibold text-foreground/90">{exam.type}</span>
          </p>
        )}
      </header>

      {exam.status === "REJECTED" && (
        <section
          className="rounded-xl border border-rose-200/90 bg-rose-50/90 p-5 text-right shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40"
          role="region"
          aria-label="سبب الرفض"
        >
          <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold text-rose-900 dark:text-rose-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            ملاحظات لجنة الاختبارات (سبب الرفض)
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-rose-950 dark:text-rose-50">
            {exam.committeeFeedback?.trim()
              ? exam.committeeFeedback.trim()
              : "لم تُسجّل اللجنة ملاحظات نصية في النظام. يُنصح بالتواصل مع اللجنة أو تعديل النموذج ثم إعادة التقديم."}
          </p>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          راجع الأسئلة والإجابات النموذجية وسلم التقييم كما اعتمدتما في النظام.
        </p>
        {exam.status === "REJECTED" ? (
          <Button asChild className="h-10 shrink-0 gap-2 rounded-lg font-semibold">
            <Link
              href={`${TEACHER_LINKS.createExam}?edit=${encodeURIComponent(exam.id)}`}
            >
              <FileEdit className="h-4 w-4" />
              تعديل النموذج وإعادة التقديم
            </Link>
          </Button>
        ) : (
          <p className="max-w-sm text-xs text-muted-foreground">
            يظهر التعديل في المحرّر عند رفض اللجنة للنموذج.
          </p>
        )}
      </div>

      <details className="group rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-right text-sm">
        <summary className="cursor-pointer list-none font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            بيانات مرجعية (تقنية)
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
          {exam.id}
        </p>
      </details>

      <section>
        <h2 className="mb-4 text-base font-bold text-foreground">
          الأسئلة والمحاور{" "}
          <span className="font-normal text-muted-foreground">
            ({questions.length})
          </span>
        </h2>
        <div className="space-y-5">
          {questions.map((q: any, qi: number) => {
            const label = getQuestionDisplayLabel(
              { displayLabel: q.displayLabel },
              qi
            );
            const qText = String(q.content ?? "");
            const ansText = String(q.modelAnswer ?? "");
            return (
              <article
                key={q.id || qi}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 pb-3">
                  <span className="text-sm font-bold text-primary">
                    السؤال {label}
                  </span>
                  <span className="tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatQuestionPointsAr(q)}
                  </span>
                </div>
                <div className="mt-4">
                  <ContentBlock text={qText}>{qText}</ContentBlock>
                </div>
                {q.modelAnswer ? (
                  <div className="mt-4 rounded-lg bg-muted/40 px-4 py-3">
                    <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                      الإجابة النموذجية
                    </p>
                    <ContentBlock text={ansText}>{ansText}</ContentBlock>
                  </div>
                ) : null}
                {q.teacherNote?.trim() ? (
                  <div className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/90 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
                    <p className="mb-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                      توجيهات إضافية للمراجعة
                    </p>
                    <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-50">
                      {q.teacherNote}
                    </p>
                  </div>
                ) : null}
                {Array.isArray(q.keyPoints) && q.keyPoints.length > 0 && (
                  <div className="mt-4 border-t border-border/50 pt-4">
                    <p className="mb-3 text-[11px] font-semibold text-muted-foreground">
                      عناصر التقييم
                    </p>
                    <ul className="space-y-3">
                      {q.keyPoints.map((kp: any, ki: number) => {
                        const pt = String(kp.point ?? "");
                        const kpEn = isPrimarilyEnglish(pt);
                        return (
                          <li
                            key={kp.id || ki}
                            className="flex flex-wrap items-start justify-between gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0"
                          >
                            <div
                              className={
                                kpEn
                                  ? "min-w-0 flex-1 text-left text-sm leading-relaxed"
                                  : "min-w-0 flex-1 text-right text-sm leading-relaxed"
                              }
                              dir={kpEn ? "ltr" : "rtl"}
                              lang={kpEn ? "en" : "ar"}
                            >
                              {pt}
                            </div>
                            <span className="shrink-0 tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                              {formatKeyPointGradeAr(kp.grade)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
          {questions.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              لا توجد أسئلة محفوظة لهذا الاختبار.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
