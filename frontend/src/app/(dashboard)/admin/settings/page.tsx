"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { SettingsForm } from "@/common/components/shared/SettingsForm";
import { ShieldCheck, Server, Database, Globe } from "lucide-react";
import { Button } from "@/common/ui/button";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";

export default function AdminSettingsPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/users/me")
      .then((res) => setUserData(res.data))
      .catch(() => {
        setUserData({
          name: "م. خالد عبدالرحمن",
          email: "admin@university.edu",
          role: "ADMIN",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoading message="جارٍ تحميل الإعدادات…" />;
  }

  const services = [
    { icon: Server, label: "API Cluster", online: true },
    { icon: Database, label: "قاعدة البيانات", online: true },
    { icon: Globe, label: "CDN Cache", online: false },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow="مدير النظام"
        title="الإعدادات"
        subtitle="حدّث بياناتك وراقب حالة الخدمات وصلاحيات النظام."
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>

        <div className="space-y-6">
          {/* Server status */}
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <h4 className="mb-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              حالة الخدمات
            </h4>
            <div className="space-y-3">
              {services.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        s.online
                          ? "flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal-light text-brand-teal"
                          : "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                      }
                    >
                      <s.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {s.label}
                    </span>
                  </div>
                  {s.online ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-teal">
                      <span className="h-2 w-2 rounded-full bg-brand-teal" />
                      نشط
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase text-muted-foreground">
                      Offline
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Root privileges */}
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-foreground">
              صلاحيات الجذر
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              راجع سجلّ التدقيق لمتابعة كل العمليات الحساسة في النظام.
            </p>
            <Button
              variant="outline"
              className="mt-4 h-10 w-full rounded-xl border-brand-teal/30 text-sm font-bold text-brand-teal hover:bg-brand-teal-light"
            >
              عرض سجلّ التدقيق
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
