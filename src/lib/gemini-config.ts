/**
 * أسماء النماذج الرسمية: https://ai.google.dev/gemini-api/docs/models
 * الافتراضي: gemini-2.5-flash (نموذج 2.5 المستقر للاستخدام العام — ليس معرّفاً كـ Pro)
 * يمكن التجاوز عبر GEMINI_MODEL في .env
 */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/** احتياطي للرؤية إذا فشل النموذج الأول */
export const GEMINI_VISION_FALLBACK_MODELS: string[] = (
  process.env.GEMINI_VISION_FALLBACK_MODELS?.split(",") || [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ]
)
  .map((s) => s.trim())
  .filter(Boolean);

/** احتياطي لنص التصحيح (بدون صور) */
export const GEMINI_TEXT_FALLBACK_MODELS: string[] = (
  process.env.GEMINI_TEXT_FALLBACK_MODELS?.split(",") || [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ]
)
  .map((s) => s.trim())
  .filter(Boolean);

export function visionModelsChain(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [GEMINI_MODEL, ...GEMINI_VISION_FALLBACK_MODELS]) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/** سلسلة نماذج لـ /api/grade (JSON نصي) */
export function textModelsChain(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [GEMINI_MODEL, ...GEMINI_TEXT_FALLBACK_MODELS]) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/**
 * نماذج التصحيح — للحصول على نفس المدخلات ≈ نفس المخرجات:
 * - الافتراضي: **نموذج واحد فقط** (GEMINI_MODEL) حتى لا يختلف التصحيح عند السقوط إلى نموذج احتياطي.
 * - ضع GEMINI_GRADING_MODEL لفرض نموذج محدد للتصحيح فقط.
 * - ضع GEMINI_GRADING_USE_FALLBACKS=true لاستعادة السلسلة الكاملة عند أعطال النموذج الأول.
 */
export function gradingModelsChain(): string[] {
  const forced = process.env.GEMINI_GRADING_MODEL?.trim();
  if (forced) return [forced];
  if (process.env.GEMINI_GRADING_USE_FALLBACKS === "true") {
    return textModelsChain();
  }
  return [GEMINI_MODEL];
}
