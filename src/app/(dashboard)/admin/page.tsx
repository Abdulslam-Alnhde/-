"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert, Settings, Users, FileText,
  Activity, Zap, Database, ArrowUpRight, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ADMIN_LINKS } from "@/lib/dashboard-links";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(res => res.json())
      .then(d => setData(d))
      .catch(() => setData({
        metrics: { totalUsers: 0, totalExams: 0, totalQuestions: 0, totalNotifications: 0 },
        roleDistribution: [],
        recentExams: []
      }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-black tracking-widest text-muted-foreground">جارِ تحميل بيانات النظام...</p>
      </div>
    );
  }

  const { metrics, roleDistribution, recentExams } = data || {
    metrics: { totalUsers: 0, totalExams: 0, totalQuestions: 0, totalNotifications: 0 },
    roleDistribution: [],
    recentExams: []
  };

  const statCards: {
    label: string;
    val: number;
    icon: typeof Users;
    color: string;
    detail: string;
    href: string;
  }[] = [
    {
      label: "إجمالي الحسابات",
      val: metrics.totalUsers,
      icon: Users,
      color: "text-blue-500",
      detail: "المستخدمين المسجلين",
      href: ADMIN_LINKS.users,
    },
    {
      label: "الاختبارات المصدرة",
      val: metrics.totalExams,
      icon: FileText,
      color: "text-indigo-500",
      detail: "جميع الحالات",
      href: ADMIN_LINKS.examsLog,
    },
    {
      label: "نقاط التقييم",
      val: metrics.totalQuestions * 3,
      icon: Zap,
      color: "text-amber-500",
      detail: "إجمالي النقاط",
      href: ADMIN_LINKS.examsLog,
    },
    {
      label: "حجم الإشعارات",
      val: metrics.totalNotifications,
      icon: ShieldAlert,
      color: "text-rose-500",
      detail: "مشاكل حرجة: ٠",
      href: ADMIN_LINKS.settings,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">لوحة إدارة النظام</h1>
          <p className="text-muted-foreground mt-4 text-sm font-bold opacity-70 italic">مركز المراقبة والتحكم الشامل في البنية التحتية للمنصة الأكاديمية.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild className="gap-2 font-black rounded-xl border-2 h-11">
            <Link href={ADMIN_LINKS.settings}><Settings className="w-4 h-4" /> الإعدادات</Link>
          </Button>
          <Button asChild className="gap-2 bg-zinc-900 text-white hover:bg-zinc-800 font-black rounded-xl h-11 shadow-xl">
            <Link href={ADMIN_LINKS.users}><Users className="w-4 h-4" /> سجل المستخدمين</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200/90 bg-card p-6 shadow-sm transition-all hover:border-indigo-300/50 hover:shadow-lg hover:shadow-slate-500/10 dark:border-zinc-800"
          >
            <div className="flex justify-between items-start">
              <div className={`p-4 rounded-2xl bg-muted group-hover:bg-primary/5 transition-colors shadow-inner ${item.color}`}>
                <item.icon className="w-7 h-7" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[2px] leading-none mb-1 opacity-60">{item.label}</p>
              <h3 className="text-3xl font-black mt-2 leading-none text-foreground tabular-nums">{item.val}</h3>
              <p className="text-[10px] italic text-muted-foreground/60 mt-3 font-bold">{item.detail}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div
            id="exams-log"
            className="scroll-mt-8 bg-card border-2 rounded-[2.5rem] shadow-lg shadow-zinc-500/5 flex flex-col overflow-hidden"
          >
            <div className="p-8 border-b-2 flex items-center justify-between bg-muted/5">
              <h3 className="text-xl font-black flex items-center gap-3"><Activity className="w-5 h-5 text-primary" /> سجل الاختبارات العام</h3>
              <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-200 uppercase tracking-widest">مزامنة مباشرة</span>
            </div>
            <div className="overflow-x-auto">
              {recentExams.length === 0 ? (
                <div className="p-20 text-center text-muted-foreground text-sm font-bold opacity-40">لا توجد اختبارات مسجلة بعد.</div>
              ) : (
                <table className="w-full text-sm text-right">
                  <thead className="border-b-2 bg-muted/30 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="py-5 px-8">المصدر</th>
                      <th className="py-5 px-8">الموضوع</th>
                      <th className="py-5 px-8">الحالة</th>
                      <th className="py-5 px-8 text-left">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2">
                    {recentExams.map((exam: any) => (
                      <tr key={exam.id} className="hover:bg-muted/30 transition-colors cursor-pointer group">
                        <td className="py-5 px-8 font-black text-foreground text-sm">{exam.teacher?.name || "النظام"}</td>
                        <td className="py-5 px-8 text-muted-foreground font-bold italic truncate max-w-[200px]">"{exam.title}"</td>
                        <td className="py-5 px-8">
                          <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ${
                            exam.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20' :
                            exam.status === 'PENDING_APPROVAL' ? 'bg-amber-500/10 text-amber-600 ring-amber-500/20' :
                            exam.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 ring-rose-500/20' :
                            'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20'
                          }`}>
                            {exam.status === 'APPROVED' ? 'معتمد' : exam.status === 'PENDING_APPROVAL' ? 'قيد المراجعة' : exam.status === 'REJECTED' ? 'مرفوض' : 'مسودة'}
                          </span>
                        </td>
                        <td className="py-5 px-8 text-left text-muted-foreground text-[10px] font-black tabular-nums">
                          {new Date(exam.createdAt).toLocaleDateString("ar-EG")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div
            id="roles-distribution"
            className="scroll-mt-8 bg-card border-2 rounded-[2.5rem] p-8 shadow-sm border-r-4 border-r-primary"
          >
            <h4 className="font-black text-xs uppercase tracking-[2px] mb-8 flex items-center gap-2 text-primary opacity-60">
              <Database className="w-4 h-4" /> توزيع الأدوار في المنظومة
            </h4>
            {roleDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground opacity-50 text-center py-4">لا يوجد مستخدمون بعد</p>
            ) : (
              <div className="space-y-6">
                {roleDistribution.map((dist: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-black">
                      <span>{dist.role === 'TEACHER' ? 'الأساتذة' : dist.role === 'COMMITTEE' ? 'أعضاء اللجنة' : 'مديرو النظام'}</span>
                      <span className="text-muted-foreground tabular-nums">{dist._count.id} مستخدم</span>
                    </div>
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full shadow-sm shadow-primary/30 transition-all duration-1000"
                        style={{ width: metrics.totalUsers > 0 ? `${(dist._count.id / metrics.totalUsers) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-950 text-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex flex-col h-full gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-2 shadow-inner">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
              </div>
              <h4 className="font-black text-xl tracking-tight">المراجعة الأمنية</h4>
              <p className="text-sm text-white/50 leading-relaxed font-bold">سجلات النظام الداخلية لا تعكس أي محاولات وصول غير مصرح بها في الفترة الحالية.</p>
              <Button className="mt-6 w-full font-black text-[10px] tracking-widest uppercase bg-white text-zinc-950 hover:bg-white/90 h-12 rounded-2xl shadow-lg">
                تشغيل الفحص الأمني
              </Button>
            </div>
            <Activity className="absolute -left-12 -bottom-12 w-48 h-48 opacity-[0.05] group-hover:scale-125 transition-transform [transition-duration:2s] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
