import type { LucideIcon } from "lucide-react";
import { cn } from "@/common/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "teal" | "orange";
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "teal",
  className,
}: EmptyStateProps) {
  const isOrange = tone === "orange";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className
      )}
    >
      <div
        className={cn(
          "inline-flex h-16 w-16 items-center justify-center rounded-2xl",
          isOrange
            ? "bg-brand-orange/10 text-brand-orange"
            : "bg-brand-teal/10 text-brand-teal"
        )}
      >
        <Icon className="h-8 w-8" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
