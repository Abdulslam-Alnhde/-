import { CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/common/lib/utils";

export type ExamStatus =
  | "APPROVED"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "DRAFT"
  | string;

const STATUS_MAP: Record<
  string,
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  APPROVED: {
    label: "معتمد",
    icon: CheckCircle2,
    cls: "border-brand-teal/40 bg-brand-teal/10 text-brand-teal-dark",
  },
  PENDING_APPROVAL: {
    label: "قيد المراجعة",
    icon: Clock,
    cls: "border-brand-teal/30 bg-brand-teal-light text-brand-teal-dark",
  },
  REJECTED: {
    label: "مرفوض",
    icon: AlertCircle,
    cls: "border-[#D32F2F]/40 bg-[#FFEBEB] text-[#D32F2F]",
  },
  DRAFT: {
    label: "مسودة",
    icon: FileText,
    cls: "border-border bg-muted text-muted-foreground",
  },
};

/**
 * شارة حالة موحّدة عبر الموقع — ألوان وأيقونات متناسقة لكل حالة.
 */
export function StatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: ExamStatus;
  className?: string;
  showIcon?: boolean;
}) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.DRAFT;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
        meta.cls,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {meta.label}
    </span>
  );
}
