export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand-teal" />
      <p className="text-sm font-semibold text-muted-foreground">
        جارٍ تحميل الصفحة…
      </p>
    </div>
  );
}
