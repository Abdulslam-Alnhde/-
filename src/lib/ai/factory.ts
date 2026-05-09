import "server-only";

import { AIProvider } from "./provider-interface";
import { OpenAIProvider } from "./providers/openai-provider";
import { XAIProvider } from "./providers/xai-provider";
import { AIServiceConfig } from "./types";

function ensureApiProvider(provider: string) {
  if (!provider) return;
}

function ensureProviderKey(params: {
  provider: "openai" | "xai" | "custom";
  apiKey: string;
  baseUrl?: string;
}) {
  const { provider, apiKey, baseUrl } = params;
  if (!apiKey) {
    if (provider === "xai") {
      throw new Error("XAI_API_KEY is missing. Set it in your environment/.env.");
    }
    throw new Error("AI_API_KEY is missing. Set it in your environment/.env.");
  }

  if (provider === "custom" && !baseUrl) {
    throw new Error("AI_BASE_URL is missing for the custom AI provider. Set it in your environment/.env.");
  }
}

export class AIFactory {
  static xaiFromEnv(): AIProvider {
    const apiKey = String(process.env.XAI_API_KEY || process.env.AI_API_KEY || "").trim();
    const baseUrl = String(process.env.AI_BASE_URL || "https://api.x.ai/v1").trim();
    return new XAIProvider(apiKey, baseUrl);
  }

  static createProvider(config: AIServiceConfig): AIProvider {
    switch (config.provider) {
      case "xai":
        return new XAIProvider(config.apiKey, config.baseUrl || "https://api.x.ai/v1");
      case "openai":
        return new OpenAIProvider(
          config.apiKey,
          config.baseUrl || "https://api.openai.com/v1",
          config.name || "openai"
        );
      case "custom":
        return new OpenAIProvider(
          config.apiKey,
          config.baseUrl,
          config.name || "custom"
        );
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  static fromEnv(): AIProvider {
    const [primary] = this.configsFromEnv();
    return this.createProvider(primary);
  }

  static configsFromEnv(): AIServiceConfig[] {
    const rawProvider = String(process.env.AI_PROVIDER || "xai").trim();
    ensureApiProvider(rawProvider);
    const provider = rawProvider as "openai" | "xai" | "custom";

    const aiApiKey = String(process.env.AI_API_KEY || "").trim();
    const xaiApiKey = String(process.env.XAI_API_KEY || "").trim();
    const baseUrl = String(process.env.AI_BASE_URL || "").trim() || undefined;

    const primaryApiKey =
      provider === "xai" ? xaiApiKey || aiApiKey : aiApiKey;

    ensureProviderKey({
      provider,
      apiKey: primaryApiKey,
      baseUrl,
    });

    const configs: AIServiceConfig[] = [
      {
        provider,
        apiKey: primaryApiKey,
        baseUrl,
        name: provider,
      },
    ];

    return configs;
  }
}
