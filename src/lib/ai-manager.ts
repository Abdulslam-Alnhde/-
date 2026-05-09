import "server-only";

import { AIFactory } from "./ai/factory";
import { AIProvider } from "./ai/provider-interface";

/**
 * مدير مفاتيح الذكاء الاصطناعي (AI Manager)
 * ---------------------------------------
 * يدعم الآن العمارة المحايدة للموديلات (Model-Agnostic)
 */

export class AIManager {
  private static instance: AIManager;

  private constructor() {
  }

  public static getInstance(): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager();
    }
    return AIManager.instance;
  }

  /**
   * مصلنع الموديلات الجديد (Universal Provider)
   */
  public getProvider(): AIProvider {
    return AIFactory.fromEnv();
  }

  public getProviderChain(): AIProvider[] {
    return AIFactory.configsFromEnv().map((c) => AIFactory.createProvider(c));
  }

  public getAvailableKeysCount(): number {
    const key = String(process.env.XAI_API_KEY || process.env.AI_API_KEY || "").trim();
    return key ? 1 : 0;
  }
}

export const aiManager = AIManager.getInstance();
