import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * مدير مفاتيح الذكاء الاصطناعي (AI Manager)
 * ---------------------------------------
 * يقوم بقراءة قائمة مفاتيح من ملف .env (مفصولة بفاصله)
 * ويوزع الضغط بينها بشكل عشوائي (Load Balancing) مع إمكانية التبديل في حال الخطأ.
 */

export class AIManager {
  private static instance: AIManager;
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;

  private constructor() {
    // قراءة المفاتيح من ملف الإعدادات
    const rawKeys = process.env.GEMINI_API_KEY || "";
    this.apiKeys = rawKeys.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
  }

  public static getInstance(): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager();
    }
    return AIManager.instance;
  }

  /**
   * اختيار مفتاح عشوائي للعملية الحالية
   */
  public getRandomKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error("لم يتم العثور على أي مفتاح GEMINI_API_KEY في ملف التكوين.");
    }
    const randomIndex = Math.floor(Math.random() * this.apiKeys.length);
    return this.apiKeys[randomIndex];
  }

  /**
   * الحصول على عميل GoogleGenerativeAI مجهز بأحد المفاتيح المتاحة
   */
  public getClient(): GoogleGenerativeAI {
    const key = this.getRandomKey();
    return new GoogleGenerativeAI(key);
  }

  /**
   * الحصول على عدد المفاتيح المتاحة
   */
  public getAvailableKeysCount(): number {
    return this.apiKeys.length;
  }
}

export const aiManager = AIManager.getInstance();
