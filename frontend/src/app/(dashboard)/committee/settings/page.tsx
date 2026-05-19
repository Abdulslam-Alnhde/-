"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { SettingsForm } from "@/common/components/shared/SettingsForm";
import { SupportRequestPanel } from "@/common/components/shared/SupportRequestPanel";
import { Lock, BellRing } from "lucide-react";
import { Button } from "@/common/ui/button";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";

export default function CommitteeSettingsPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/users/me")
      .then((res) => setUserData(res.data))
      .catch(() => {
        setUserData({
          name: "أ. فاطمة الزهراء",
          email: "committee1@university.edu",
          role: "COMMITTEE",
          profileLocked: true,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoading message="جارِ تحميل الإعدادات..." />;
  }

  const securityRows = [
    {
      icon: Lock,
      tone: "teal" as const,
      label: "المصادقة الثنائية",
      action: "تفعيل",
    },
    {
      icon: BellRing,
      tone: "orange" as const,
      label: "تنبيهات المراجعة",
      action: "إدارة",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow="لجنة المراجعة"
        title="الإعدادات"
        subtitle="حدّث بياناتك وإعدادات الأمان وتواصل مع الدعم."
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <h4 className="mb-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              الأمان
            </h4>
            <div className="space-y-3">
              {securityRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        row.tone === "teal"
                          ? "flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal"
                          : "flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange"
                      }
                    >
                      <row.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {row.label}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs font-bold"
                  >
                    {row.action}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <SupportRequestPanel />
        </div>
      </div>
    </div>
  );
}
