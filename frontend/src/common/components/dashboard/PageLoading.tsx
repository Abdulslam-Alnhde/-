import { Loader2 } from "lucide-react";

export function PageLoading({
  message = "جارِ التحميل...",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-teal/20" />
        <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal-light">
          <Loader2 className="h-6 w-6 animate-spin text-brand-teal" />
        </div>
      </div>
      <p className="text-sm font-bold tracking-wider text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
