"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { useExamStore } from "@/store/useExamStore";
import { Loader2 } from "lucide-react";

function parseExamDate(description: string | null | undefined): string {
  if (!description) return "";
  const m = String(description).match(/Exam Date:\s*([^\n]+)/);
  return m ? m[1].trim() : "";
}

/**
 * Loads a rejected exam into the wizard when URL has ?edit=<examId>.
 */
export function CreateExamEditLoader() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { setExamDetails, setExtractedQuestions, setStep, setEditingExamId } =
    useExamStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editId) {
      setEditingExamId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get(`/api/exams/${editId}`)
      .then((res) => {
        if (cancelled) return;
        const exam = res.data;
        if (exam.status !== "REJECTED") {
          setError("يمكن التعديل فقط للاختبارات ذات الحالة «مرفوضة».");
          setEditingExamId(null);
          return;
        }

        setEditingExamId(exam.id);
        setExamDetails({
          title: exam.title || "",
          date: parseExamDate(exam.description),
          type: exam.type || "MIDTERM",
          totalGrade:
            typeof exam.totalGrade === "number" && exam.totalGrade > 0
              ? Math.round(exam.totalGrade)
              : exam.totalGrade,
        });

        const questions = (exam.questions || []).map((q: any) => ({
          question: q.content || "",
          modelAnswer: q.modelAnswer || "",
          displayLabel: q.displayLabel,
          teacherNote: q.teacherNote || "",
          questionMaxPoints:
            typeof q.points === "number" && q.points > 0 ? q.points : undefined,
          keyPoints: (q.keyPoints || []).map((kp: any) => ({
            point: kp.point || "",
            defaultGrade: Number(kp.grade) || 0,
          })),
        }));

        setExtractedQuestions(questions);
        setStep(3);
      })
      .catch(() => {
        if (!cancelled) setError("تعذر تحميل الاختبار للتعديل.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editId, setEditingExamId, setExamDetails, setExtractedQuestions, setStep]);

  // Leaving edit mode: optional reset when user navigates away from ?edit=
  useEffect(() => {
    if (!editId) return;
    return () => {
      // no-op: keep store until unmount of wizard
    };
  }, [editId]);

  if (!editId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm font-bold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <Loader2 className="h-4 w-4 animate-spin" />
        جارٍ تحميل الاختبار للتعديل…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </div>
    );
  }

  return null;
}
