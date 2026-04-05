"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { SettingsForm } from "@/components/shared/SettingsForm";
import { SupportRequestPanel } from "@/components/shared/SupportRequestPanel";
import { Loader2, ShieldCheck, Mail, User } from "lucide-react";

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
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-black tracking-widest text-muted-foreground">جارِ تحميل الإعدادات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">الإعدادات</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h4 className="font-semibold text-xs text-muted-foreground mb-5">معلومات الحساب</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-teal/10 text-brand-teal"><User className="w-4 h-4" /></div>
                <div>
                   <p className="text-xs text-muted-foreground leading-none opacity-60">الاسم</p>
                   <p className="text-sm font-medium mt-1">{userData.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-teal/10 text-brand-teal"><Mail className="w-4 h-4" /></div>
                <div>
                   <p className="text-xs text-muted-foreground leading-none opacity-60">البريد</p>
                   <p className="text-sm font-medium mt-1" dir="ltr">{userData.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-teal/10 text-brand-teal"><ShieldCheck className="w-4 h-4" /></div>
                <div>
                   <p className="text-xs text-muted-foreground leading-none opacity-60">الصلاحية</p>
                   <p className="text-sm font-medium mt-1">{userData.role === 'TEACHER' ? 'أستاذ مقرر' : userData.role === 'COMMITTEE' ? 'لجنة مراجعة' : 'مدير نظام'}</p>
                </div>
              </div>
            </div>
          </div>

          <SupportRequestPanel />
        </div>
      </div>
    </div>
  );
}
