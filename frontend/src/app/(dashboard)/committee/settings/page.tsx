"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { SettingsForm } from "@/components/shared/SettingsForm";
import { SupportRequestPanel } from "@/components/shared/SupportRequestPanel";
import { Loader2, ShieldCheck, Mail, User, Lock, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            <h4 className="font-semibold text-xs text-muted-foreground mb-5">الأمان</h4>
            <div className="space-y-3">
               <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-teal/10 text-brand-teal"><Lock className="w-4 h-4" /></div>
                    <span className="text-xs font-medium text-muted-foreground">المصادقة الثنائية</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3 font-medium rounded-lg">تفعيل</Button>
               </div>
               <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange"><BellRing className="w-4 h-4" /></div>
                    <span className="text-xs font-medium text-muted-foreground">تنبيهات المراجعة</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3 font-medium rounded-lg">إدارة</Button>
               </div>
            </div>
          </div>

          <SupportRequestPanel />
        </div>
      </div>
    </div>
  );
}
