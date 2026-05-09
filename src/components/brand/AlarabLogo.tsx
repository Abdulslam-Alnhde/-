import Image from "next/image";
import { cn } from "@/lib/utils";

type AlarabLogoProps = {
  className?: string;
  variant?: "stacked" | "inline";
  size?: "sm" | "md" | "lg";
  priority?: boolean;
};

const W = 498;
const H = 501;

const sizeClass = {
  sm: "max-h-9 sm:max-h-10",
  md: "max-h-28 sm:max-h-32",
  lg: "max-h-40 sm:max-h-48 md:max-h-[13rem]",
};

/**
 * شعار جامعة العرب — الحجم يُقيَّد بـ max-height فقط مع h-auto وobject-contain لعدم التشويه.
 */
export function AlarabLogo({
  className,
  variant = "stacked",
  size = "md",
  priority = false,
}: AlarabLogoProps) {
  const inline = variant === "inline";

  return (
    <div
      className={cn(
        "inline-flex max-w-full shrink-0 items-center justify-center",
        inline && "max-w-[min(100%,280px)]",
        className
      )}
    >
      <Image
        src="/images/alarab-university-logo.png"
        alt="جامعة العرب — Alarab University"
        width={W}
        height={H}
        priority={priority}
        sizes={
          inline
            ? "(max-width: 640px) 100px, 140px"
            : "(max-width: 640px) 75vw, 320px"
        }
        className={cn(
          "h-auto w-auto max-w-full object-contain",
          sizeClass[size]
        )}
      />
    </div>
  );
}
