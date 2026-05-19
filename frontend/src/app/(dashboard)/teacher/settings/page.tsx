"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { SettingsForm } from "@/common/components/shared/SettingsForm";
import { SupportRequestPanel } from "@/common/components/shared/SupportRequestPanel";
import { ShieldCheck, Mail, User } from "lucide-react";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { PageLoading } from "@/common/components/dashboard/PageLoading";

export default function TeacherSettingsPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/users/me")
      .then((res) => setUserData(res.data))
      .catch(() => {
        setUserData({
          name: "د. أحمد محمد علي",
          email: "ahmed.teacher@university.edu",
          role: "TEACHER",
          profileLocked: true,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoading message="جارِ تحميل الإعدادات..." />;
  }

  const accountRows = [
    { icon: User, label: "الاسم", value: userData.name },
    { icon: Mail, label: "البريد", value: userData.email, ltr: true },
    {
      icon: ShieldCheck,
      label: "الصلاحية",
      value:
        userData.role === "TEACHER"
          ? "أستاذ مقرر"
          : userData.role === "COMMITTEE"
            ? "لجنة مراجعة"
            : "مدير نظام",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow="الأستاذ"
        title="الإعدادات"
        subtitle="حدّث بياناتك الشخصية وكلمة المرور وتواصل مع الدعم."
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <h4 className="mb-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              معلومات الحساب
            </h4>
            <div className="space-y-4">
              {accountRows.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
                    <row.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">
                      {row.label}
                    </p>
                    <p
                      className="mt-0.5 truncate text-sm font-bold text-foreground"
                      dir={row.ltr ? "ltr" : undefined}
                    >
                      {row.value}
                    </p>
                  </div>
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
