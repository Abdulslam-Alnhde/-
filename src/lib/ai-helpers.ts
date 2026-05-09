import "server-only";

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
export function userFacingAIError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (isTransientNetworkError(err)) {
    return (
      "تعذّر الاتصال بخدمة الذكاء الاصطناعي. تحقّق من: الإنترنت، الجدار الناري، وإن لزم VPN. " +
      "تأكد أن مفاتيح الذكاء الاصطناعي صحيحة في ملف .env ثم أعد تشغيل الخادم."
    );
  }
  if (
    lower.includes("api key") ||
    lower.includes("invalid api") ||
    lower.includes("permission denied") ||
    lower.includes("403")
  ) {
    return "مفتاح مزوّد الذكاء الاصطناعي غير صالح أو بلا صلاحية. حدّث مفتاح API في ملف .env ثم أعد المحاولة.";
  }
  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate limit")) {
    return "لقد وصلت إلى حد الاستخدام المسموح به (Rate Limit). يرجى المحاولة مرة أخرى بعد دقيقة.";
  }

  if (lower.includes("503") || lower.includes("service unavailable") || lower.includes("overloaded")) {
    return "خدمة الذكاء الاصطناعي تواجه ضغطاً كبيراً حالياً (503). انتظر قليلاً ثم أعد المحاولة.";
  }

  if (lower.includes("timeout") && (lower.includes("exceeded") || lower.includes("ms") || lower.includes("etimedout"))) {
    return (
      "انتهت مهلة طلب الذكاء الاصطناعي قبل اكتمال الاستخراج. جرّب تقليل حجم الملف أو عدد الصفحات، " +
      "أو زِد المهلة عبر المتغير AI_REQUEST_TIMEOUT_MS في ملف .env ثم أعد تشغيل الخادم."
    );
  }

  if (msg.length > 280) {
    return "فشل طلب الذكاء الاصطناعي. راجع الطرفية (Terminal) للتفاصيل.";
  }
  return msg;
}

