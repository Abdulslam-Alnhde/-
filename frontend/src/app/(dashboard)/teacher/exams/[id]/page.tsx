"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { TeacherExamDetailView } from "@/modules/exams/components/TeacherExamDetailView";

export default function TeacherExamDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [exam, setExam] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("معرّف الاختبار غير صالح.");
      return;
    }
    setLoading(true);
    setError(null);
    axios
      .get(`/api/exams/${id}`)
      .then((res) => setExam(res.data))
      .catch(() => setError("تعذر تحميل الاختبار أو ليس لديك صلاحية عرضه."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm font-black text-muted-foreground">
          جارٍ تحميل تفاصيل الاختبار…
        </p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="rounded-xl border border-[#D32F2F]/30 bg-[#FFEBEB] px-6 py-8 text-center font-bold text-[#D32F2F]">
        {error || "غير موجود"}
      </div>
    );
  }

  return <TeacherExamDetailView exam={exam} />;
}
