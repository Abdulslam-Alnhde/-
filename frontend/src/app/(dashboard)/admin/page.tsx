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

  const metrics = data?.metrics || { totalUsers: 0, totalExams: 0, totalQuestions: 0, totalNotifications: 0 };
  const roleDistribution = data?.roleDistribution || [];
  const recentExams = data?.recentExams || [];

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
      color: "text-brand-teal",
      detail: "المستخدمين المسجلين",
      href: ADMIN_LINKS.users,
    },
    {
      label: "الاختبارات المصدرة",
      val: metrics.totalExams,
      icon: FileText,
      color: "text-brand-teal",
      detail: "جميع الحالات",
      href: ADMIN_LINKS.examsLog,
    },
    {
      label: "نقاط التقييم",
      val: metrics.totalQuestions * 3,
      icon: Zap,
      color: "text-brand-orange",
      detail: "إجمالي النقاط",
      href: ADMIN_LINKS.examsLog,
    },
    {
      label: "حجم الإشعارات",
      val: metrics.totalNotifications,
      icon: ShieldAlert,
      color: "text-brand-teal",
      detail: "مشاكل حرجة: ٠",
      href: ADMIN_LINKS.settings,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">لوحة الإدارة</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild className="gap-2 font-medium rounded-xl border h-10">
            <Link href={ADMIN_LINKS.settings}><Settings className="w-4 h-4" /> الإعدادات</Link>
          </Button>
          <Button asChild className="gap-2 bg-primary text-white hover:bg-[#008F84] font-medium rounded-xl h-10 shadow-md shadow-primary/20">
            <Link href={ADMIN_LINKS.users}><Users className="w-4 h-4" /> المستخدمون</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-brand-teal/40 hover:shadow-lg hover:shadow-black/8"
          >
            <div className="flex justify-between items-start">
              <div className={`p-4 rounded-2xl bg-muted group-hover:bg-primary/5 transition-colors shadow-inner ${item.color}`}>
                <item.icon className="w-7 h-7" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground leading-none mb-2 opacity-70">{item.label}</p>
              <h3 className="text-3xl font-bold mt-1 leading-none text-foreground tabular-nums">{item.val}</h3>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div
            id="exams-log"
            className="scroll-mt-8 bg-card border-2 rounded-[2.5rem] shadow-lg shadow-black/5 flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b flex items-center justify-between bg-muted/5">
              <h3 className="text-base font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> سجل الاختبارات</h3>
            </div>
            <div className="overflow-x-auto">
              {recentExams.length === 0 ? (
                <div className="p-20 text-center text-muted-foreground text-sm font-bold opacity-40">لا توجد اختبارات مسجلة بعد.</div>
              ) : (
                <table className="w-full text-sm text-right">
                  <thead className="border-b bg-[#F8F8F8] text-muted-foreground font-medium text-xs dark:bg-[#162A28] dark:text-[#A8C8C6]">
                    <tr>
                      <th className="py-5 px-8">المصدر</th>
                      <th className="py-5 px-8">الموضوع</th>
                      <th className="py-5 px-8">الحالة</th>
                      <th className="py-5 px-8 text-left">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2">
                    {recentExams.map((exam: any) => (
                      <tr key={exam.id} className="hover:bg-[#F0FAFA] transition-colors cursor-pointer group dark:hover:bg-[#1E3530]">
                        <td className="py-5 px-8 font-medium text-foreground text-sm">{exam.teacher?.name || "النظام"}</td>
                        <td className="py-5 px-8 text-muted-foreground font-medium truncate max-w-[200px]">{exam.title}</td>
                        <td className="py-5 px-8">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ring-1 ring-inset ${
                            exam.status === 'APPROVED' ? 'bg-brand-teal/10 text-brand-teal ring-brand-teal/20' :
                            exam.status === 'PENDING_APPROVAL' ? 'bg-brand-orange/10 text-brand-orange ring-brand-orange/20' :
                            exam.status === 'REJECTED' ? 'bg-[#FFEBEB] text-[#D32F2F] ring-[#D32F2F]/20' :
                            'bg-muted text-muted-foreground ring-border'
                          }`}>
                            {exam.status === 'APPROVED' ? 'معتمد' : exam.status === 'PENDING_APPROVAL' ? 'قيد المراجعة' : exam.status === 'REJECTED' ? 'مرفوض' : 'مسودة'}
                          </span>
                        </td>
                        <td className="py-5 px-8 text-left text-muted-foreground text-xs font-medium tabular-nums">
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
            className="scroll-mt-8 bg-card border rounded-2xl p-6 shadow-sm"
          >
            <h4 className="font-semibold text-sm mb-6 flex items-center gap-2 text-foreground">
              <Database className="w-4 h-4 text-primary" /> توزيع الأدوار
            </h4>
            {roleDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground opacity-50 text-center py-4">لا يوجد مستخدمون بعد</p>
            ) : (
              <div className="space-y-6">
                {roleDistribution.map((dist: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{dist.role === 'TEACHER' ? 'الأساتذة' : dist.role === 'COMMITTEE' ? 'أعضاء اللجنة' : 'مديرو النظام'}</span>
                      <span className="text-muted-foreground tabular-nums">{dist._count.id}</span>
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

          <div className="relative overflow-hidden rounded-2xl border border-[#E8E8E8] bg-card p-6 shadow-sm group">
            <div className="relative z-10 flex flex-col h-full gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-teal/15 flex items-center justify-center shadow-inner ring-1 ring-brand-teal/20">
                <ShieldAlert className="w-5 h-5 text-brand-teal" />
              </div>
              <h4 className="font-semibold text-base mt-1 text-foreground">الفحص الأمني</h4>
              <Button className="mt-4 w-full font-medium text-sm bg-primary text-primary-foreground hover:bg-[#008F84] h-10 rounded-xl shadow shadow-primary/20">
                تشغيل الفحص
              </Button>
            </div>
            <Activity className="absolute -left-12 -bottom-12 w-48 h-48 text-brand-teal opacity-[0.06] group-hover:scale-125 transition-transform [transition-duration:2s] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
