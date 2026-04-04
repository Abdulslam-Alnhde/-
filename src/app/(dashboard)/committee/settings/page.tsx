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
        <h1 className="text-4xl font-black tracking-tight text-foreground underline decoration-primary decoration-4 underline-offset-8">تفضيلات النظام</h1>
        <p className="text-muted-foreground mt-4 text-sm font-bold opacity-70 italic">إدارة ملفك الشخصي كعضو لجنة ومحفزات التنبيهات.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-card border-2 rounded-[2rem] p-8 shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-[2px] text-muted-foreground mb-6 opacity-60">الأمان والوصول</h4>
            <div className="space-y-5">
               <div className="flex items-center justify-between p-4 rounded-2xl border-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-inner"><Lock className="w-5 h-5" /></div>
                    <span className="text-xs font-black text-muted-foreground">المصادقة الثنائية</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] px-3 font-black rounded-xl border-2">تفعيل</Button>
               </div>
               <div className="flex items-center justify-between p-4 rounded-2xl border-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 shadow-inner"><BellRing className="w-5 h-5" /></div>
                    <span className="text-xs font-black text-muted-foreground">تنبيهات المراجعة</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] px-3 font-black rounded-xl border-2">إدارة</Button>
               </div>
            </div>
          </div>

          <div className="rounded-[2rem] border-2 border-amber-200 bg-amber-50 p-8 dark:border-amber-800 dark:bg-amber-900/10">
            <h4 className="mb-3 text-sm font-black text-amber-800 dark:text-amber-300">
              تذكير بروتوكولي
            </h4>
            <p className="mb-6 text-[11px] font-bold italic leading-relaxed text-amber-700 opacity-80 dark:text-amber-400">
              بصفتك عضواً في اللجنة، فإن اعتماداتك تؤثر مباشرة على الشهادات الأكاديمية. راجع تقارير
              التصحيح الآلي يدوياً للتحقق من الدقة الدلالية.
            </p>
          </div>

          <SupportRequestPanel />
        </div>
      </div>
    </div>
  );
}
