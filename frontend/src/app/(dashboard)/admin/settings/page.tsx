"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { SettingsForm } from "@/components/shared/SettingsForm";
import { Loader2, ShieldCheck, Mail, User, Server, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminSettingsPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock user fetch
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
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">
          جارٍ تحميل الإعدادات…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">الإعدادات</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h4 className="font-semibold text-xs mb-5 text-muted-foreground">حالة الخوادم</h4>
            <div className="space-y-5">
               <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-teal/10 text-brand-teal"><Server className="w-4 h-4" /></div>
                    <span className="text-xs font-medium text-foreground">API Cluster</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-brand-teal shadow-sm shadow-brand-teal/50" />
               </div>
               <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-teal/10 text-brand-teal"><Database className="w-4 h-4" /></div>
                    <span className="text-xs font-medium text-foreground">قاعدة البيانات</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-brand-teal shadow-sm shadow-brand-teal/50" />
               </div>
               <div className="flex items-center justify-between group opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground"><Globe className="w-4 h-4" /></div>
                    <span className="text-xs font-medium">CDN Cache</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Offline</span>
               </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[#E8E8E8] bg-card p-6 shadow-sm group">
             <div className="relative z-10 flex flex-col h-full">
               <div className="bg-brand-teal/10 ring-1 ring-brand-teal/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                 <ShieldCheck className="w-5 h-5 text-brand-teal" />
               </div>
               <h4 className="font-semibold text-sm mt-3 text-foreground">Root Privileges</h4>
               <Button variant="outline" className="mt-5 h-9 border-brand-teal/30 text-brand-teal hover:bg-brand-teal/10 text-xs font-medium">
                 View Audit Logs
               </Button>
             </div>
             <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-brand-teal/10 rounded-full blur-3xl group-hover:bg-brand-teal/20 transition-all [transition-duration:2s] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
