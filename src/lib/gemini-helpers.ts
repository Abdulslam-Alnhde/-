/** أخطاء شبكة مؤقتة يُعاد المحاولة عندها قبل تجربة نموذج آخر */
export function isTransientNetworkError(err: unknown): boolean {
  const raw =
    err instanceof Error
      ? err.message + String((err as Error & { cause?: unknown }).cause ?? "")
      : String(err);
  const m = raw.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("econnrefused") ||
    m.includes("etimedout") ||
    m.includes("enotfound") ||
    m.includes("getaddrinfo") ||
    m.includes("socket") ||
    m.includes("network") ||
    m.includes("aborted") ||
    m.includes("eai_again")
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** رسالة للمستخدم النهائي (عربي) بدل تفاصيل SDK الخام */
export function userFacingGeminiError(err: unknown): string {
  if (isTransientNetworkError(err)) {
    return (
      "تعذّر الاتصال بخادم Google (Gemini). تحقّق من: الإنترنت، الجدار الناري، وإن لزم VPN. " +
      "تأكد أن GEMINI_API_KEY صالح في ملف .env ثم نفّذ: npm run verify-ai"
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("api key") ||
    lower.includes("invalid api") ||
    lower.includes("permission denied") ||
    lower.includes("403")
  ) {
    return "مفتاح Gemini غير صالح أو بلا صلاحية. أنشئ مفتاحاً من Google AI Studio وحدّث GEMINI_API_KEY في .env.";
  }
  if (msg.length > 280) {
    return "فشل طلب الذكاء الاصطناعي. راجع الطرفية (Terminal) حيث يعمل npm run dev للتفاصيل.";
  }
  return msg;
}
