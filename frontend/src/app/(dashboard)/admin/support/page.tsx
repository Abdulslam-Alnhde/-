"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Loader2,
  Headphones,
  Send,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { EmptyState } from "@/common/components/dashboard/EmptyState";

type Row = {
  id: string;
  message: string;
  attachments: string[];
  status: "PENDING" | "ANSWERED";
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    employeeCode: string | null;
  };
  repliedBy: { id: string; name: string } | null;
};

export default function AdminSupportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    axios
      .get<Row[]>("/api/support-tickets")
      .then((res) => setRows(res.data))
      .catch(() => {
        setError("تعذر تحميل الطلبات.");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(id: string) {
    const text = (replyDraft[id] || "").trim();
    if (!text) return;
    setSavingId(id);
    try {
      await axios.patch(`/api/support-tickets/${id}`, { adminReply: text });
      setReplyDraft((d) => ({ ...d, [id]: "" }));
      load();
    } catch {
      setError("تعذر حفظ الرد.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow="مدير النظام"
        title="الدعم الفني"
        subtitle="استقبل طلبات الموظفين وردّ عليها وتابع حالتها."
      />

      {error && (
        <p
          className="rounded-xl bg-[#FFEBEB] px-4 py-3 text-sm font-bold text-[#D32F2F]"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading ? (
        <PageLoading message="جارِ تحميل الطلبات…" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card ring-1 ring-border">
          <EmptyState
            icon={Headphones}
            title="لا توجد طلبات حالياً"
            description="ستظهر هنا طلبات الدعم الواردة من الأساتذة واللجان."
          />
        </div>
      ) : (
        <ul className="space-y-6">
          {rows.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl bg-card p-6 ring-1 ring-border"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{t.user.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {t.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.user.role}
                      {t.user.employeeCode ? ` — ${t.user.employeeCode}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                      t.status === "ANSWERED"
                        ? "bg-brand-teal/10 text-brand-teal-dark"
                        : "bg-brand-orange/10 text-brand-orange-dark"
                    )}
                  >
                    {t.status === "ANSWERED" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {t.status === "ANSWERED" ? "تم الرد" : "معلق"}
                  </span>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString("ar-SA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium leading-relaxed text-foreground">
                {t.message}
              </p>

              {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {t.attachments.map((src) => (
                    <a
                      key={src}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-24 w-24 object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {t.adminReply && (
                <div className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal-light/50 p-4">
                  <p className="text-xs font-bold text-brand-teal-dark">
                    رد سابق
                    {t.repliedBy?.name ? ` — ${t.repliedBy.name}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {t.adminReply}
                  </p>
                </div>
              )}

              <div className="mt-5 space-y-2">
                <label className="text-xs font-bold text-muted-foreground">
                  {t.status === "ANSWERED" ? "تحديث الرد" : "الرد"}
                </label>
                <textarea
                  value={replyDraft[t.id] ?? ""}
                  onChange={(e) =>
                    setReplyDraft((d) => ({ ...d, [t.id]: e.target.value }))
                  }
                  placeholder="اكتب ردك للموظف…"
                  rows={4}
                  maxLength={8000}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none transition focus:border-brand-teal/70 focus:ring-2 focus:ring-brand-teal/20"
                />
                <Button
                  type="button"
                  onClick={() => sendReply(t.id)}
                  disabled={
                    savingId === t.id || !(replyDraft[t.id] || "").trim()
                  }
                  className="h-10 gap-1.5 rounded-xl bg-brand-teal font-bold text-white hover:bg-brand-teal/90"
                >
                  {savingId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      إرسال الرد
                    </>
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
