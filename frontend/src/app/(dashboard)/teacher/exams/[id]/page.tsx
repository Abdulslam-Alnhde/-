"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { AlertCircle } from "lucide-react";
import { TeacherExamDetailView } from "@/modules/exams/components/TeacherExamDetailView";
import { PageLoading } from "@/common/components/dashboard/PageLoading";

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
    return <PageLoading message="جارٍ تحميل تفاصيل الاختبار…" />;
  }

  if (error || !exam) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#D32F2F]/30 bg-[#FFEBEB] px-6 py-16 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D32F2F]/10 text-[#D32F2F]">
          <AlertCircle className="h-7 w-7" />
        </div>
        <p className="text-base font-bold text-[#D32F2F]">
          {error || "الاختبار غير موجود"}
        </p>
      </div>
    );
  }

  return <TeacherExamDetailView exam={exam} />;
}
