"use client";

import { useEffect, useState } from "react";

import { 
  Inbox, Bell, CheckCircle, Clock, Trash2, 
  MessageSquare, AlertCircle, Loader2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };


  const getTypeStyles = (type: string) => {
    switch (type) {
      case "status_change":
        return "bg-brand-teal/10 text-brand-teal";
      case "graded":
        return "bg-brand-teal/10 text-brand-teal";
      case "alert":
        return "bg-[#FFEBEB] text-[#D32F2F] dark:bg-[#2A1616] dark:text-[#EF5350]";
      default:
        return "bg-primary/10 text-primary";
    }
  };

  return (
    <div className="flex h-full flex-col space-y-8">
      <div className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            التنبيهات
          </h1>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="gap-2 font-medium rounded-xl h-9" onClick={fetchNotifications}>
             <Sparkles className="w-4 h-4" /> تحديث
           </Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-lg shadow-black/5 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-muted/10">
           <div className="flex items-center gap-2 font-medium text-sm">
             <Inbox className="w-4 h-4 text-primary" /> الوارد
             <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs">
               {notifications.filter(n => !n.isRead).length}
             </span>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">جارِ التحميل...</p>
             </div>
          ) : notifications.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <div className="bg-muted p-6 rounded-full"><Bell className="w-10 h-10 text-muted-foreground" /></div>
                <h3 className="text-base font-semibold">لا توجد تنبيهات</h3>
             </div>
          ) : (
             <div className="divide-y divide-border/50">
                 {notifications.map((n) => (
                   <div
                     key={n.id}
                     onClick={() => !n.isRead && markAsRead(n.id)}
                     className={`group relative flex cursor-pointer items-start gap-5 p-6 transition-colors hover:bg-muted/30 ${!n.isRead ? "bg-primary/5 shadow-inner" : ""}`}
                   >
                      {!n.isRead && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      
                      <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${getTypeStyles(n.type)}`}>
                        {n.type === "status_change" ? <Clock className="w-6 h-6" /> : 
                         n.type === "graded" ? <CheckCircle className="w-6 h-6" /> : 
                         <AlertCircle className="w-6 h-6" />}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-sm ${!n.isRead ? "text-primary" : "text-foreground"}`}>{n.title}</h4>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5 opacity-60">
                            <Clock className="w-3 h-3" />
                            {new Date(n.createdAt).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${!n.isRead ? "text-foreground/80 font-bold" : "text-muted-foreground font-medium"}`}>
                          {n.message}
                        </p>
                        <div className="pt-2 text-xs text-muted-foreground opacity-60">
                           {new Date(n.createdAt).toLocaleDateString("ar-EG")}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                         {!n.isRead && (
                            <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
                         )}
                         <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                   </div>
                 ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
