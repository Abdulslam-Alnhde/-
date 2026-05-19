import type { LucideIcon } from "lucide-react";
import { cn } from "@/common/lib/utils";

type SectionCardProps = {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * بطاقة محتوى موحّدة — header بسيط (أيقونة + عنوان + إجراء) + body. بدون gradients.
 */
export function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl bg-card ring-1 ring-border",
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}
