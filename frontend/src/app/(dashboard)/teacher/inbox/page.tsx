"use client";

import { useEffect, useState } from "react";
import {
  Inbox,
  Bell,
  CheckCircle,
  Clock,
  Trash2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { PageHeader } from "@/common/components/dashboard/PageHeader";
import { SectionCard } from "@/common/components/dashboard/SectionCard";
import { PageLoading } from "@/common/components/dashboard/PageLoading";
import { EmptyState } from "@/common/components/dashboard/EmptyState";

export default function TeacherInboxPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "status_change":
      case "graded":
        return "bg-brand-teal-light text-brand-teal";
      case "alert":
        return "bg-[#FFEBEB] text-[#D32F2F]";
      default:
        return "bg-brand-orange/10 text-brand-orange";
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow="الأستاذ"
        title="التنبيهات"
        subtitle="إشعارات حالة الاختبارات والتصحيح والملاحظات."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl font-bold"
            onClick={fetchNotifications}
          >
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        }
      />

      <SectionCard
        title="الوارد"
        icon={Inbox}
        action={
          unreadCount > 0 && (
            <span className="rounded-full bg-brand-teal px-2.5 py-0.5 text-xs font-bold text-white">
              {unreadCount} جديد
            </span>
          )
        }
      >
        {loading ? (
          <PageLoading message="جارِ تحميل التنبيهات..." />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="لا توجد تنبيهات"
            description="ستظهر هنا إشعارات حالة اختباراتك ونتائج التصحيح."
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markAsRead(n.id)}
                className={cn(
                  "group relative flex cursor-pointer items-start gap-4 px-6 py-5 transition-colors hover:bg-muted/40",
                  !n.isRead && "bg-brand-teal-light/40"
                )}
              >
                {!n.isRead && (
                  <span className="absolute right-0 top-0 bottom-0 w-1 bg-brand-teal" />
                )}

                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    getTypeStyles(n.type)
                  )}
                >
                  {n.type === "status_change" ? (
                    <Clock className="h-5 w-5" />
                  ) : n.type === "graded" ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4
                      className={cn(
                        "text-sm font-bold",
                        !n.isRead ? "text-brand-teal-dark" : "text-foreground"
                      )}
                    >
                      {n.title}
                    </h4>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(n.createdAt).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      !n.isRead
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {n.message}
                  </p>
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString("ar-EG")}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-brand-teal" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-[#D32F2F] group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
