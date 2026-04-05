import "server-only";

import { AIFactory } from "./ai/factory";
import { AIProvider } from "./ai/provider-interface";
import {
  AIContentPart,
  AIRequestOptions,
  AIResponse,
} from "./ai/types";
import {
  isTransientNetworkError,
  sleep,
} from "./ai-helpers";

/**
 * مدير مزوّدات الذكاء الاصطناعي (Service-aware)
 * ----------------------------------------------
 * يدعم ضبطاً مستقلاً لكل خدمة عبر متغيرات بيئة:
 *   - استخراج المعلم:   TEACHER_EXTRACTION_*
 *   - استخراج الطالب:  STUDENT_EXTRACTION_*
 *   - التصحيح:        GRADING_*
 * مع رجوع تلقائي إلى المتغيرات العامّة AI_* في غياب القيم الخاصّة.
 *
 * الميزة الإضافية: مفتاح موحّد للخدمتين (الاستخراج) عبر EXTRACTION_PROVIDER/_API_KEY/_BASE_URL/_MODELS
 * عند عدم تعريف المخصّص للخدمة.
 */

export type AIService =
  | "teacherExtraction"
  | "studentExtraction"
  | "grading";

const SERVICE_ENV_PREFIX: Record<AIService, string> = {
  teacherExtraction: "TEACHER_EXTRACTION",
  studentExtraction: "STUDENT_EXTRACTION",
  grading: "GRADING",
};

const SERVICE_FALLBACK_PREFIX: Record<AIService, string | undefined> = {
  teacherExtraction: "EXTRACTION", // مفتاح موحّد لخدمتي الاستخراج
  studentExtraction: "EXTRACTION",
  grading: undefined,
};

const DEFAULT_MODELS_BY_PROVIDER: Record<string, string[]> = {
  ollama: ["gemma4:e4b"],
  gemini: ["gemini-2.0-flash"],
  openai: ["gpt-4o-mini"],
  xai: ["grok-4-1-fast-non-reasoning"],
  custom: ["gemma4:e4b"],
};

function pickEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null) {
      const trimmed = String(v).trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function dedupe(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of models) {
    const t = m.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function parseModelList(raw: string | undefined): string[] {
  if (!raw) return [];
  return dedupe(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function tryConfigForServiceEnv(
  envPrefix: string | undefined
): { provider: AIProvider; providerKind: string } | null {
  if (!envPrefix) return null;
  if (
    !pickEnv(
      `${envPrefix}_PROVIDER`,
      `${envPrefix}_API_KEY`,
      `${envPrefix}_BASE_URL`
    )
  ) {
    return null;
  }
  try {
    const cfg = AIFactory.configForService(envPrefix);
    const provider = AIFactory.createProvider(cfg);
    return { provider, providerKind: cfg.provider };
  } catch {
    return null;
  }
}

export class AIManager {
  private static instance: AIManager;

  public static getInstance(): AIManager {
    if (!AIManager.instance) AIManager.instance = new AIManager();
    return AIManager.instance;
  }

  /** مزوّد عام (للتوافق مع كود قديم). */
  public getProvider(): AIProvider {
    return AIFactory.fromEnv();
  }

  /** سلسلة المزوّدات العامّة (للتوافق مع كود قديم). */
  public getProviderChain(): AIProvider[] {
    return [AIFactory.fromEnv()];
  }

  public getAvailableKeysCount(): number {
    const key = String(process.env.XAI_API_KEY || process.env.AI_API_KEY || "").trim();
    return key ? 1 : 0;
  }

  /** يختار المزوّد الخاصّ بخدمة (مع رجوع لمزوّد مشترك أو لـ AI_* العامّ).
   * التصحيح يعمل افتراضياً على نموذج محلي (Ollama) إن لم يُحدّد له مزوّد. */
  public getServiceProvider(service: AIService): AIProvider {
    const envPrefix = SERVICE_ENV_PREFIX[service];
    const fallbackPrefix = SERVICE_FALLBACK_PREFIX[service];

    const explicit =
      tryConfigForServiceEnv(envPrefix)?.provider ??
      tryConfigForServiceEnv(fallbackPrefix)?.provider;
    if (explicit) return explicit;

    if (service === "grading") {
      try {
        return AIFactory.createProvider({
          provider: "ollama",
          apiKey: pickEnv("OLLAMA_API_KEY") || "ollama",
          baseUrl: pickEnv("OLLAMA_BASE_URL") || "http://127.0.0.1:11434/v1",
          name: "ollama",
        });
      } catch {
        // fall through to global config
      }
    }

    return AIFactory.fromEnv();
  }

  /** سلسلة النماذج لخدمة معيّنة. */
  public getServiceModels(service: AIService): string[] {
    const envPrefix = SERVICE_ENV_PREFIX[service];
    const fallbackPrefix = SERVICE_FALLBACK_PREFIX[service];

    const explicit =
      parseModelList(pickEnv(`${envPrefix}_MODELS`)) ||
      (fallbackPrefix ? parseModelList(pickEnv(`${fallbackPrefix}_MODELS`)) : []);
    if (explicit.length > 0) return explicit;

    if (service === "grading") {
      const forced = pickEnv("AI_GRADING_MODEL");
      if (forced) return [forced];
    }

    const globalModels = parseModelList(process.env.AI_MODELS);
    if (globalModels.length > 0) return globalModels;

    // افتراضات مبنية على نوع المزوّد
    const provider = this.getServiceProviderKind(service);
    return DEFAULT_MODELS_BY_PROVIDER[provider] || ["grok-4-1-fast-non-reasoning"];
  }

  /** نوع المزوّد المختار للخدمة (للأغراض التشخيصية والافتراضات). */
  public getServiceProviderKind(service: AIService): string {
    const envPrefix = SERVICE_ENV_PREFIX[service];
    const fallbackPrefix = SERVICE_FALLBACK_PREFIX[service];
    const explicit =
      pickEnv(`${envPrefix}_PROVIDER`) ||
      (fallbackPrefix ? pickEnv(`${fallbackPrefix}_PROVIDER`) : "");
    if (explicit) return explicit.toLowerCase();

    // التصحيح ⇒ محلي افتراضياً
    if (service === "grading") return "ollama";

    return (pickEnv("AI_PROVIDER") || "xai").toLowerCase();
  }

  /**
   * توليد محتوى موحّد لخدمة معيّنة مع تجربة سلسلة النماذج.
   * يستخدمه أي مسار يحتاج استدعاءً مباشراً وبسيطاً.
   * المسارات الأكثر تعقيداً (دفعات/إنقاذ) تستطيع استدعاء `getServiceProvider` مباشرةً.
   */
  public async generateContent(params: {
    service: AIService;
    parts: AIContentPart[];
    options: Omit<AIRequestOptions, "model"> & { model?: string };
    modelChain?: string[];
    maxAttemptsPerModel?: number;
  }): Promise<AIResponse & { modelUsed: string; providerName: string }> {
    const provider = this.getServiceProvider(params.service);
    const models =
      (params.options.model ? [params.options.model] : null) ??
      params.modelChain ??
      this.getServiceModels(params.service);

    const attempts = Math.max(1, Math.min(3, params.maxAttemptsPerModel ?? 2));
    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const result = await provider.generateContent(params.parts, {
            ...params.options,
            model,
          });
          if (!result?.text || !result.text.trim()) {
            lastError = new Error(`${provider.name} returned an empty response.`);
            continue;
          }
          return { ...result, modelUsed: model, providerName: provider.name };
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          const lower = msg.toLowerCase();

          // Hard failures → switch to next model immediately.
          if (
            lower.includes("429") ||
            lower.includes("503") ||
            lower.includes("overloaded") ||
            lower.includes("auth error") ||
            lower.includes("invalid api")
          ) {
            break;
          }

          if (isTransientNetworkError(err) && attempt < attempts) {
            await sleep(750 * attempt);
            continue;
          }

          // Other errors: try next model.
          break;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("AI generation failed for all configured models.");
  }
}

export const aiManager = AIManager.getInstance();
