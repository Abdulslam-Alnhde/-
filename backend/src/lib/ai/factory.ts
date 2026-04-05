import "server-only";

import { AIProvider } from "./provider-interface";
import { OpenAIProvider } from "./providers/openai-provider";
import { XAIProvider } from "./providers/xai-provider";
import { AIProviderKind, AIServiceConfig } from "./types";

const DEFAULT_BASE_URLS: Record<AIProviderKind, string | undefined> = {
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
  ollama: "http://127.0.0.1:11434/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  custom: undefined,
};

function normalizeProvider(raw: string): AIProviderKind {
  const v = raw.trim().toLowerCase();
  if (v === "openai" || v === "xai" || v === "ollama" || v === "gemini" || v === "custom") {
    return v;
  }
  return "xai";
}

function ensureProviderKey(params: {
  provider: AIProviderKind;
  apiKey: string;
  baseUrl?: string;
}) {
  const { provider, apiKey, baseUrl } = params;

  // Local Ollama doesn't require a real API key.
  if (provider === "ollama") return;

  if (!apiKey) {
    if (provider === "xai") {
      throw new Error("XAI_API_KEY is missing. Set it in your environment/.env.");
    }
    if (provider === "gemini") {
      throw new Error("GEMINI_API_KEY (or AI_API_KEY) is missing. Set it in your environment/.env.");
    }
    throw new Error("AI_API_KEY is missing. Set it in your environment/.env.");
  }

  if (provider === "custom" && !baseUrl) {
    throw new Error("AI_BASE_URL is missing for the custom AI provider. Set it in your environment/.env.");
  }
}

export class AIFactory {
  static createProvider(config: AIServiceConfig): AIProvider {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[config.provider];
    switch (config.provider) {
      case "xai":
        return new XAIProvider(config.apiKey, baseUrl || "https://api.x.ai/v1");
      case "openai":
        return new OpenAIProvider(
          config.apiKey,
          baseUrl || "https://api.openai.com/v1",
          config.name || "openai"
        );
      case "ollama":
        return new OpenAIProvider(
          config.apiKey || "ollama",
          baseUrl || "http://127.0.0.1:11434/v1",
          config.name || "ollama"
        );
      case "gemini":
        return new OpenAIProvider(
          config.apiKey,
          baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
          config.name || "gemini"
        );
      case "custom":
        return new OpenAIProvider(
          config.apiKey,
          baseUrl,
          config.name || "custom"
        );
      default:
        throw new Error(`Unsupported AI provider: ${(config as AIServiceConfig).provider}`);
    }
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
   * Build a config from per-service env, falling back to global AI_* vars.
   * For example, service "GRADING" reads GRADING_PROVIDER, GRADING_API_KEY,
   * GRADING_BASE_URL — falling back to AI_PROVIDER, AI_API_KEY, AI_BASE_URL.
   */
  static configForService(serviceEnvPrefix: string): AIServiceConfig {
    const rawProvider = AIFactory.pickEnv(
      `${serviceEnvPrefix}_PROVIDER`,
      "AI_PROVIDER"
    ) || "xai";
    const provider = normalizeProvider(rawProvider);

    const apiKey = AIFactory.pickEnv(
      `${serviceEnvPrefix}_API_KEY`,
      provider === "xai" ? "XAI_API_KEY" : "",
      provider === "gemini" ? "GEMINI_API_KEY" : "",
      "AI_API_KEY",
      provider === "xai" ? "AI_API_KEY" : ""
    );

    const baseUrl =
      AIFactory.pickEnv(`${serviceEnvPrefix}_BASE_URL`, "AI_BASE_URL") ||
      DEFAULT_BASE_URLS[provider];

    ensureProviderKey({ provider, apiKey, baseUrl });

    return {
      provider,
      apiKey,
      baseUrl,
      name: provider,
    };
  }

  /** Backward-compat: legacy global config (uses AI_PROVIDER + global keys). */
  static configsFromEnv(): AIServiceConfig[] {
    return [AIFactory.configForService("AI")];
  }

  static fromEnv(): AIProvider {
    return AIFactory.createProvider(AIFactory.configForService("AI"));
  }
}
