import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/common/lib/utils";

type Tone = "teal" | "orange" | "danger" | "neutral";

type StatCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  href?: string;
  className?: string;
};

const TONES: Record<Tone, { iconBg: string; iconText: string }> = {
  teal: { iconBg: "bg-brand-teal-light", iconText: "text-brand-teal" },
  orange: { iconBg: "bg-brand-orange/10", iconText: "text-brand-orange" },
  danger: { iconBg: "bg-[#FFEBEB]", iconText: "text-[#D32F2F]" },
  neutral: { iconBg: "bg-muted", iconText: "text-muted-foreground" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "teal",
  hint,
  href,
  className,
}: StatCardProps) {
  const t = TONES[tone];

  const inner = (
    <>
      <div
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-xl",
          t.iconBg,
          t.iconText
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-6 text-[2.5rem] font-black leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm font-bold text-muted-foreground">{label}</p>
      {hint && (
        <p className="mt-1 text-[11px] font-medium text-muted-foreground/70">
          {hint}
        </p>
      )}
    </>
  );

  const baseCls = cn(
    "block rounded-2xl bg-card p-6 ring-1 ring-border transition-all duration-200",
    href &&
      "hover:-translate-y-0.5 hover:ring-foreground/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40",
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseCls}>
        {inner}
      </Link>
    );
  }

  return <div className={baseCls}>{inner}</div>;
}
