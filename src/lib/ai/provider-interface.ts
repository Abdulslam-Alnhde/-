import { AIContentPart, AIRequestOptions, AIResponse } from "./types";

export interface AIProvider {
  name: string;
  generateContent(
    parts: AIContentPart[],
    options: AIRequestOptions
  ): Promise<AIResponse>;
}
