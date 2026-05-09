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

export interface AIServiceConfig {
  apiKey: string;
  baseUrl?: string;
  name?: string;
  provider:
    | "openai"
    | "xai"
    | "custom"
    ;
}
