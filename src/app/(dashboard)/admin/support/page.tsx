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
import { Button } from "@/components/ui/button";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground underline decoration-primary decoration-4 underline-offset-8">
          طلبات الدعم الفني
        </h1>
        <p className="mt-3 text-sm font-bold text-muted-foreground">
          راجع الطلبات وأرسل الرد للموظف — يصل الإشعار داخل النظام وعبر البريد إن وُجد SMTP.
        </p>
      </div>

      {error && (
        <p className="text-sm font-bold text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">جارِ التحميل…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-16 text-center">
          <Headphones className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
          <p className="text-sm font-bold text-muted-foreground">لا توجد طلبات حالياً.</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {rows.map((t) => (
            <li
              key={t.id}
              className="rounded-[1.5rem] border-2 border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <p className="font-black text-foreground">{t.user.name}</p>
                    <p className="text-xs font-bold text-muted-foreground ltr" dir="ltr">
                      {t.user.email}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t.user.role}
                      {t.user.employeeCode ? ` — ${t.user.employeeCode}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                      t.status === "ANSWERED"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {t.status === "ANSWERED" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {t.status === "ANSWERED" ? "تم الرد" : "معلق"}
                  </span>
                  <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString("ar-SA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              <p className="text-sm font-bold leading-relaxed">{t.message}</p>

              {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {t.attachments.map((src) => (
                    <a
                      key={src}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-24 w-24 object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {t.adminReply && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[10px] font-black text-primary">
                    رد سابق
                    {t.repliedBy?.name ? ` — ${t.repliedBy.name}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{t.adminReply}</p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {t.status === "ANSWERED" ? "تحديث الرد (يستبدل الرد السابق)" : "رد المشرف"}
                </label>
                <textarea
                  value={replyDraft[t.id] ?? ""}
                  onChange={(e) =>
                    setReplyDraft((d) => ({ ...d, [t.id]: e.target.value }))
                  }
                  placeholder="اكتب ردك للموظف…"
                  rows={4}
                  maxLength={8000}
                  className="w-full resize-y rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 ring-primary/20"
                />
                <Button
                  type="button"
                  onClick={() => sendReply(t.id)}
                  disabled={savingId === t.id || !(replyDraft[t.id] || "").trim()}
                  className="font-black"
                >
                  {savingId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="ms-1 h-4 w-4" />
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
