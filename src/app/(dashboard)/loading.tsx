export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600 dark:border-zinc-700 dark:border-t-teal-400" />
      <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
        جارٍ تحميل الصفحة…
      </p>
    </div>
  );
}
