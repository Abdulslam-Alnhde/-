import { cn } from "@/common/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  variant?: "default" | "banner";
  className?: string;
};

/**
 * عنوان موحّد للصفحات — هادئ، نظيف، بدون زخارف.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  variant = "banner",
  className,
}: PageHeaderProps) {
  if (variant === "default") {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between",
          className
        )}
      >
        <div className="min-w-0">
          {eyebrow && (
            <span className="inline-block rounded-full bg-brand-teal-light px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-teal-dark">
              {eyebrow}
            </span>
          )}
          <h1
            className={cn(
              "text-2xl font-black tracking-tight md:text-3xl",
              eyebrow && "mt-3"
            )}
            style={{ color: "#1A2E2D" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            {actions}
          </div>
        )}
      </div>
    );
  }

  // banner — quiet, just spacing
  return (
    <div
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full bg-brand-teal-light px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-teal-dark">
            {eyebrow}
          </span>
        )}
        <h1
          className={cn(
            "text-3xl font-black leading-tight tracking-tight md:text-[2rem]",
            eyebrow && "mt-3"
          )}
          style={{ color: "#1A2E2D" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
