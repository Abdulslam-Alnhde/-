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
        <h1 className="text-3xl font-extrabold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground mt-1 text-sm font-bold">Manage system-wide parameters and root administrator profile.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <SettingsForm initialData={userData} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h4 className="font-black text-[10px] uppercase tracking-[2px] mb-6 text-muted-foreground">Infrastructure Nodes</h4>
            <div className="space-y-5">
               <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><Server className="w-4 h-4" /></div>
                    <span className="text-xs font-bold text-foreground">API Cluster 01</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
               </div>
               <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><Database className="w-4 h-4" /></div>
                    <span className="text-xs font-bold text-foreground">Postgres Master</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
               </div>
               <div className="flex items-center justify-between group opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground"><Globe className="w-4 h-4" /></div>
                    <span className="text-xs font-medium italic">CDN Edge Cache</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Offline</span>
               </div>
            </div>
          </div>

          <div className="bg-zinc-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group">
             <div className="relative z-10 flex flex-col h-full">
               <div className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md">
                 <ShieldCheck className="w-5 h-5 text-emerald-400" />
               </div>
               <h4 className="font-black text-sm uppercase tracking-tight mb-2">Root Privileges</h4>
               <p className="text-[11px] text-white/50 mb-6 leading-relaxed">
                 You have unrestricted access to all university data and system logs. All root actions are audited and recorded for compliance.
               </p>
               <Button className="mt-auto h-9 bg-white text-zinc-950 hover:bg-white/90 text-[10px] font-black uppercase tracking-widest">
                 View Audit Logs
               </Button>
             </div>
             <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all [transition-duration:2s]" />
          </div>
        </div>
      </div>
    </div>
  );
}
