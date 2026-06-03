export type AIModelType = "text" | "vision";

export interface AIContentPart {
  text?: string;
  image?: {
    base64: string;
    mimeType: string;
  };
  /** PDF files — providers that support native PDF (e.g. Gemini) send it as inlineData */
  pdf?: {
    base64: string;
    mimeType: string; // always "application/pdf"
  };
}

export interface AIRequestOptions {
  model: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
  /**
   * Controls how much the model "thinks" before answering (Gemini 2.5 thinking models).
   * Lower effort = faster + cheaper, which suits OCR/transcription tasks.
   * Ignored for non-thinking models (e.g. gemini-2.0-*).
   */
  reasoningEffort?: "none" | "low" | "medium" | "high";
}

export interface AIResponse {
  text: string;
  raw?: any;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AIProviderKind = "gemini";

export interface AIServiceConfig {
  apiKey: string;
  baseUrl?: string;
  name?: string;
  provider: AIProviderKind;
}
