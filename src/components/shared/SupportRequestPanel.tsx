"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Headphones, ImagePlus, Loader2, Send, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

type Ticket = {
  id: string;
  message: string;
  attachments: string[];
  status: "PENDING" | "ANSWERED";
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  repliedBy?: { id: string; name: string } | null;
};

export function SupportRequestPanel() {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(() => {
    setLoadingList(true);
    axios
      .get<Ticket[]>("/api/support-tickets")
      .then((res) => setTickets(res.data))
      .catch(() => setTickets([]))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const text = message.trim();
    if (!text) {
      setError("اكتب وصفاً للمشكلة أو الملاحظات.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("message", text);
      files.forEach((f) => fd.append("files", f));
      await axios.post("/api/support-tickets", fd);
      setMessage("");
      setFiles([]);
      setSuccess(true);
      load();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : "تعذر إرسال الطلب.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border-2 border-primary/15 bg-primary/5 p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-right">
            <h4 className="text-sm font-black text-primary">التواصل مع الدعم الفني</h4>
            <p className="mt-1 text-xs font-bold leading-relaxed text-muted-foreground opacity-90">
              أرسل ملاحظاتك وصوراً توضيحية (اختياري). يصل الطلب للمشرف ويظهر رده هنا وفي صندوق
              الإشعارات عند الرد.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="صف المشكلة أو طلبك…"
            rows={5}
            maxLength={8000}
            className="w-full resize-y rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-semibold outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-primary/25 bg-background px-4 py-2.5 text-xs font-black text-primary transition hover:border-primary/50">
              <ImagePlus className="h-4 w-4" />
              إرفاق صور (حتى ٥ صور، ٤ ميجا لكل منها)
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  setFiles(list.slice(0, 5));
                }}
              />
            </label>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-xl font-black"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="ms-1 h-4 w-4" />
                  إرسال الطلب
                </>
              )}
            </Button>
          </div>
          {files.length > 0 && (
            <p className="text-[11px] font-bold text-muted-foreground">
              مرفقات: {files.map((f) => f.name).join("، ")}
            </p>
          )}
          {error && (
            <p className="text-xs font-bold text-destructive" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-2 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              تم إرسال طلبك بنجاح.
            </p>
          )}
        </form>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground opacity-70">
          طلباتك السابقة
        </h4>
        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-8 text-center text-xs font-bold text-muted-foreground">
            لا توجد طلبات بعد.
          </p>
        ) : (
          <ul className="space-y-4">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
                    {t.status === "ANSWERED" ? "تم الرد" : "قيد المراجعة"}
                  </span>
                  <time className="text-[10px] font-bold text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString("ar-SA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                <p className="text-sm font-bold leading-relaxed text-foreground">{t.message}</p>
                {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.attachments.map((src) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="h-20 w-20 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {t.adminReply && (
                  <div className="mt-4 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wide text-primary">
                      رد المشرف
                      {t.repliedBy?.name ? ` — ${t.repliedBy.name}` : ""}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed">{t.adminReply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
