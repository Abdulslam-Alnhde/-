import { AIProvider } from "./provider-interface";
import { GeminiProvider } from "./providers/gemini-provider";
import { AIProviderKind, AIServiceConfig } from "./types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

function normalizeProvider(raw: string): AIProviderKind {
  const provider = raw.trim().toLowerCase();
  if (!provider || provider === "gemini") return "gemini";
  return "gemini";
}

function ensureProviderKey(apiKey: string) {
  if (!apiKey || apiKey === "YOUR_GOOGLE_GEMINI_API_KEY_HERE") {
    throw new Error("GEMINI_API_KEY is missing. Set it in your environment/.env.");
  }
}

export class AIFactory {
  static createProvider(config: AIServiceConfig): AIProvider {
    return new GeminiProvider(config.apiKey, config.baseUrl || GEMINI_BASE_URL);
  }

  /** Pick env value with the first defined-and-trimmed key. */
  static pickEnv(...keys: string[]): string {
    for (const k of keys) {
      const v = process.env[k];
      if (v != null) {
        const trimmed = String(v).trim();
        if (trimmed) return trimmed;
      }
    }
    return "";
  }

  /**
   * Build a Google Gemini config from service-specific keys when present,
   * otherwise from the global Gemini key.
   */
  static configForService(serviceEnvPrefix: string): AIServiceConfig {
    const rawProvider = AIFactory.pickEnv(
      `${serviceEnvPrefix}_PROVIDER`,
      "AI_PROVIDER"
    ) || "gemini";
    const provider = normalizeProvider(rawProvider);

    const apiKey = AIFactory.pickEnv(
      `${serviceEnvPrefix}_API_KEY`,
      "GEMINI_API_KEY"
    );

    const baseUrl =
      AIFactory.pickEnv(`${serviceEnvPrefix}_BASE_URL`, "AI_BASE_URL") ||
      GEMINI_BASE_URL;

    ensureProviderKey(apiKey);

    return {
      provider,
      apiKey,
      baseUrl,
      name: provider,
    };
  }

  /** Backward-compat: legacy global config name, now Gemini-only. */
  static configsFromEnv(): AIServiceConfig[] {
    return [AIFactory.configForService("AI")];
  }

  static fromEnv(): AIProvider {
    return AIFactory.createProvider(AIFactory.configForService("AI"));
  }
}
