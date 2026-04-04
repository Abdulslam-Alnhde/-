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
        <h1 className="text-4xl font-black tracking-tight text-foreground underline decoration-primary decoration-4 underline-offset-8">إعدادات الحساب</h1>
        <p className="text-muted-foreground mt-4 text-sm font-bold opacity-70 italic">تهيئة ملفك الشخصي وتفضيلات النظام الأكاديمي.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-card border-2 rounded-[2rem] p-8 shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-[2px] text-muted-foreground mb-6 opacity-60">معلومات الحساب</h4>
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 shadow-inner"><User className="w-5 h-5" /></div>
                <div>
                   <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest leading-none opacity-60">الهوية</p>
                   <p className="text-sm font-black mt-1.5">{userData.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-inner"><Mail className="w-5 h-5" /></div>
                <div>
                   <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest leading-none opacity-60">البريد الإلكتروني</p>
                   <p className="text-sm font-black mt-1.5 ltr" dir="ltr">{userData.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-inner"><ShieldCheck className="w-5 h-5" /></div>
                <div>
                   <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest leading-none opacity-60">مستوى الصلاحية</p>
                   <p className="text-sm font-black mt-1.5">{userData.role === 'TEACHER' ? 'أستاذ مقرر' : userData.role === 'COMMITTEE' ? 'لجنة مراجعة' : 'مدير نظام'}</p>
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
