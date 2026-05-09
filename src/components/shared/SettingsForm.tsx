"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Shield,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Send,
  Building2,
  Briefcase,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "@/lib/motion";

export interface SettingsFormInitialData {
  id?: string;
  name: string;
  email: string;
  role: string;
  profileLocked?: boolean;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employeeCode?: string | null;
}

interface SettingsFormProps {
  initialData: SettingsFormInitialData;
}

export function SettingsForm({ initialData }: SettingsFormProps) {
  const [formData, setFormData] = useState({
    name: initialData.name,
    phone: initialData.phone ?? "",
    department: initialData.department ?? "",
    jobTitle: initialData.jobTitle ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const profileLocked = initialData.profileLocked ?? false;
  const userId = initialData.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      if (profileLocked) {
        if (!userId) {
          setErrorMsg("تعذر تحديد المستخدم. أعد تحميل الصفحة.");
          return;
        }
        const res = await fetch("/api/profile-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            payload: {
              name: formData.name.trim(),
              phone: formData.phone.trim() || undefined,
              department: formData.department.trim() || undefined,
              jobTitle: formData.jobTitle.trim() || undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "فشل إرسال الطلب");
          return;
        }
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
      } else {
        const res = await fetch("/api/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone.trim() || null,
            department: formData.department.trim() || null,
            jobTitle: formData.jobTitle.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "فشل حفظ التعديلات");
          return;
        }
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 mt-8 animate-in fade-in duration-700">
      <div className="bg-card border rounded-2xl p-10 shadow-lg shadow-zinc-500/5">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex items-center gap-6 mb-10 pb-8 border-b border-dashed">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/20 shadow-inner">
              {formData.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-2xl font-black text-foreground">إعدادات الملف الشخصي</h3>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                {profileLocked
                  ? "الحساب مقفل للتعديل المباشر. عدّل الحقول أدناه ثم أرسل طلباً للمشرف للاعتماد."
                  : "تحديث معلوماتك الشخصية وتفضيلات الحساب."}
              </p>
            </div>
          </div>

          {profileLocked && (
            <div className="rounded-2xl border-2 border-amber-200/80 bg-amber-50/60 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
              <p className="font-black flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                تعديل بياناتك يتطلب موافقة المشرف بعد إرسال الطلب.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> الاسم الكامل
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-5 py-4 bg-background border-2 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> رقم الجوال
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                dir="ltr"
                className="w-full px-5 py-4 bg-background border-2 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> القسم / الإدارة
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                className="w-full px-5 py-4 bg-background border-2 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> المسمى الوظيفي
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) =>
                  setFormData({ ...formData, jobTitle: e.target.value })
                }
                className="w-full px-5 py-4 bg-background border-2 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> البريد الإلكتروني الجامعي
              </label>
              <input
                type="email"
                value={initialData.email}
                disabled
                className="w-full px-5 py-4 bg-muted border-2 rounded-2xl text-sm cursor-not-allowed opacity-70 font-bold"
              />
              <p className="text-[10px] text-muted-foreground font-bold italic px-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> يتم إدارة البريد من قبل إدارة الجامعة ولا يمكن تغييره يدوياً.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> الرتبة الأكاديمية / الصلاحية
              </label>
              <div className="w-full px-5 py-4 bg-muted border-2 rounded-2xl text-sm font-black flex items-center gap-3 opacity-70">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                {initialData.role === "ADMIN"
                  ? "مدير نظام"
                  : initialData.role === "COMMITTEE"
                    ? "لجنة مراجعة"
                    : "أستاذ مقرر"}
              </div>
            </div>

            {initialData.employeeCode && (
              <p className="text-xs font-bold text-muted-foreground">
                الرقم الوظيفي:{" "}
                <span className="font-mono text-foreground">{initialData.employeeCode}</span>
              </p>
            )}
          </div>

          <div className="pt-6 flex items-center justify-between border-t border-dashed flex-wrap gap-4">
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-emerald-600 text-sm font-black"
                >
                  <CheckCircle className="w-4 h-4" />
                  {profileLocked
                    ? "تم إرسال طلب التعديل إلى المشرف."
                    : "تم حفظ التغييرات بنجاح!"}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={isSaving}
              className="mr-auto min-w-[180px] h-12 rounded-2xl gap-3 shadow-xl hover:shadow-primary/20 transition-all font-black bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : profileLocked ? (
                <Send className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isSaving
                ? "جارِ الإرسال..."
                : profileLocked
                  ? "إرسال طلب التعديل للمشرف"
                  : "حفظ التغييرات"}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-rose-500/5 border-2 border-rose-500/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h4 className="font-black text-rose-600 text-lg">منطقة الخطر</h4>
          <p className="text-xs text-muted-foreground font-medium max-w-md">
            بمجرد تعطيل حسابك، سيتم حذف جميع بياناتك نهائياً. لا يمكن التراجع عن هذا الإجراء.
          </p>
        </div>
        <Button
          variant="outline"
          type="button"
          className="text-rose-600 border-rose-500/20 hover:bg-rose-600 hover:text-white transition-all font-black h-12 px-6 rounded-xl border-2 shrink-0"
        >
          تعطيل الحساب الأكاديمي
        </Button>
      </div>
    </div>
  );
}
