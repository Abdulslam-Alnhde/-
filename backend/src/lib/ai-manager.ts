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
 * Ù…Ø¯ÙŠØ± Ù…Ø²ÙˆÙ‘Ø¯Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ (Service-aware)
 * ----------------------------------------------
 * ÙŠØ¯Ø¹Ù… Ø¶Ø¨Ø·Ø§Ù‹ Ù…Ø³ØªÙ‚Ù„Ø§Ù‹ Ù„ÙƒÙ„ Ø®Ø¯Ù…Ø© Ø¹Ø¨Ø± Ù…ØªØºÙŠØ±Ø§Øª Ø¨ÙŠØ¦Ø©:
 *   - Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ù…Ø¹Ù„Ù…:   TEACHER_EXTRACTION_*
 *   - Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ø·Ø§Ù„Ø¨:  STUDENT_EXTRACTION_*
 *   - Ø§Ù„ØªØµØ­ÙŠØ­:        GRADING_*
 * Ù…Ø¹ Ø±Ø¬ÙˆØ¹ ØªÙ„Ù‚Ø§Ø¦ÙŠ Ø¥Ù„Ù‰ Ø§Ù„Ù…ØªØºÙŠØ±Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ù‘Ø© AI_* ÙÙŠ ØºÙŠØ§Ø¨ Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ø®Ø§ØµÙ‘Ø©.
 *
 * Ø§Ù„Ù…ÙŠØ²Ø© Ø§Ù„Ø¥Ø¶Ø§ÙÙŠØ©: Ù…ÙØªØ§Ø­ Ù…ÙˆØ­Ù‘Ø¯ Ù„Ù„Ø®Ø¯Ù…ØªÙŠÙ† (Ø§Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬) Ø¹Ø¨Ø± EXTRACTION_PROVIDER/_API_KEY/_BASE_URL/_MODELS
 * Ø¹Ù†Ø¯ Ø¹Ø¯Ù… ØªØ¹Ø±ÙŠÙ Ø§Ù„Ù…Ø®ØµÙ‘Øµ Ù„Ù„Ø®Ø¯Ù…Ø©.
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
  teacherExtraction: "EXTRACTION", // Ù…ÙØªØ§Ø­ Ù…ÙˆØ­Ù‘Ø¯ Ù„Ø®Ø¯Ù…ØªÙŠ Ø§Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬
  studentExtraction: "EXTRACTION",
  grading: undefined,
};

const DEFAULT_MODELS_BY_PROVIDER: Record<string, string[]> = {
  gemini: ["gemini-2.0-flash"],
  openai: ["gpt-4o-mini"],
  xai: ["gemini-2.0-flash"],
  custom: ["gemini-2.0-flash"],
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

  /** Ù…Ø²ÙˆÙ‘Ø¯ Ø¹Ø§Ù… (Ù„Ù„ØªÙˆØ§ÙÙ‚ Ù…Ø¹ ÙƒÙˆØ¯ Ù‚Ø¯ÙŠÙ…). */
  public getProvider(): AIProvider {
    return AIFactory.fromEnv();
  }

  /** Ø³Ù„Ø³Ù„Ø© Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ù‘Ø© (Ù„Ù„ØªÙˆØ§ÙÙ‚ Ù…Ø¹ ÙƒÙˆØ¯ Ù‚Ø¯ÙŠÙ…). */
  public getProviderChain(): AIProvider[] {
    return [AIFactory.fromEnv()];
  }

  public getAvailableKeysCount(): number {
    const key = String(
      process.env.GEMINI_API_KEY || process.env.XAI_API_KEY || process.env.AI_API_KEY || ""
    ).trim();
    return key ? 1 : 0;
  }

  /** ÙŠØ®ØªØ§Ø± Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯ Ø§Ù„Ø®Ø§ØµÙ‘ Ø¨Ø®Ø¯Ù…Ø© (Ù…Ø¹ Ø±Ø¬ÙˆØ¹ Ù„Ù…Ø²ÙˆÙ‘Ø¯ Ù…Ø´ØªØ±Ùƒ Ø£Ùˆ Ù„Ù€ AI_* Ø§Ù„Ø¹Ø§Ù…Ù‘).
   * Ø§Ù„ØªØµØ­ÙŠØ­ ÙŠØ¹Ù…Ù„ Ø§ÙØªØ±Ø§Ø¶ÙŠØ§Ù‹ Ø¹Ù„Ù‰ Ù†Ù…ÙˆØ°Ø¬ Ù…Ø­Ù„ÙŠ (Gemini) Ø¥Ù† Ù„Ù… ÙŠÙØ­Ø¯Ù‘Ø¯ Ù„Ù‡ Ù…Ø²ÙˆÙ‘Ø¯. */
  public getServiceProvider(service: AIService): AIProvider {
    const envPrefix = SERVICE_ENV_PREFIX[service];
    const fallbackPrefix = SERVICE_FALLBACK_PREFIX[service];

    const explicit =
      tryConfigForServiceEnv(envPrefix)?.provider ??
      tryConfigForServiceEnv(fallbackPrefix)?.provider;
    if (explicit) return explicit;

    return AIFactory.fromEnv();
  }

  /** Ø³Ù„Ø³Ù„Ø© Ø§Ù„Ù†Ù…Ø§Ø°Ø¬ Ù„Ø®Ø¯Ù…Ø© Ù…Ø¹ÙŠÙ‘Ù†Ø©. */
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

    // Ø§ÙØªØ±Ø§Ø¶Ø§Øª Ù…Ø¨Ù†ÙŠØ© Ø¹Ù„Ù‰ Ù†ÙˆØ¹ Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯
    const provider = this.getServiceProviderKind(service);
    return DEFAULT_MODELS_BY_PROVIDER[provider] || ["gemini-2.0-flash"];
  }

  /** Ù†ÙˆØ¹ Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯ Ø§Ù„Ù…Ø®ØªØ§Ø± Ù„Ù„Ø®Ø¯Ù…Ø© (Ù„Ù„Ø£ØºØ±Ø§Ø¶ Ø§Ù„ØªØ´Ø®ÙŠØµÙŠØ© ÙˆØ§Ù„Ø§ÙØªØ±Ø§Ø¶Ø§Øª). */
  public getServiceProviderKind(service: AIService): string {
    const envPrefix = SERVICE_ENV_PREFIX[service];
    const fallbackPrefix = SERVICE_FALLBACK_PREFIX[service];
    const explicit =
      pickEnv(`${envPrefix}_PROVIDER`) ||
      (fallbackPrefix ? pickEnv(`${fallbackPrefix}_PROVIDER`) : "");
    if (explicit) return explicit.toLowerCase();

    // Ø§Ù„ØªØµØ­ÙŠØ­ â‡’ Ù…Ø­Ù„ÙŠ Ø§ÙØªØ±Ø§Ø¶ÙŠØ§Ù‹
    return (pickEnv("AI_PROVIDER") || "gemini").toLowerCase();
  }

  /**
   * ØªÙˆÙ„ÙŠØ¯ Ù…Ø­ØªÙˆÙ‰ Ù…ÙˆØ­Ù‘Ø¯ Ù„Ø®Ø¯Ù…Ø© Ù…Ø¹ÙŠÙ‘Ù†Ø© Ù…Ø¹ ØªØ¬Ø±Ø¨Ø© Ø³Ù„Ø³Ù„Ø© Ø§Ù„Ù†Ù…Ø§Ø°Ø¬.
   * ÙŠØ³ØªØ®Ø¯Ù…Ù‡ Ø£ÙŠ Ù…Ø³Ø§Ø± ÙŠØ­ØªØ§Ø¬ Ø§Ø³ØªØ¯Ø¹Ø§Ø¡Ù‹ Ù…Ø¨Ø§Ø´Ø±Ø§Ù‹ ÙˆØ¨Ø³ÙŠØ·Ø§Ù‹.
   * Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± ØªØ¹Ù‚ÙŠØ¯Ø§Ù‹ (Ø¯ÙØ¹Ø§Øª/Ø¥Ù†Ù‚Ø§Ø°) ØªØ³ØªØ·ÙŠØ¹ Ø§Ø³ØªØ¯Ø¹Ø§Ø¡ `getServiceProvider` Ù…Ø¨Ø§Ø´Ø±Ø©Ù‹.
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

          // Hard failures â†’ switch to next model immediately.
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
