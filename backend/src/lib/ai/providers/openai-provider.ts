import "server-only";

import { AIProvider } from "../provider-interface";
import { AIContentPart, AIRequestOptions, AIResponse } from "../types";
import axios from "axios";

function summarizeAxiosError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : String(err);
  }

  const status = err.response?.status;
  const statusText = err.response?.statusText;
  const data = err.response?.data as any;
  const providerMsg =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.message === "string" && data.message) ||
    "";
  const base = [status, statusText].filter(Boolean).join(" ");
  const detail = providerMsg || err.message || "";
  return [base, detail].filter(Boolean).join(" - ").trim();
}

export class OpenAIProvider implements AIProvider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(
    apiKey: string,
    baseUrl: string = "https://api.openai.com/v1",
    name = "openai"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.name = name;
    // استخراج PDF/صور قد يتجاوز 90ث؛ الافتراضي 5 دقائق (قابل للتعديل عبر AI_REQUEST_TIMEOUT_MS)
    this.timeoutMs = Math.max(
      15000,
      Math.min(600000, Number(process.env.AI_REQUEST_TIMEOUT_MS) || 300000)
    );
  }

  async generateContent(
    parts: AIContentPart[],
    options: AIRequestOptions
  ): Promise<AIResponse> {
    if (!this.apiKey || !this.apiKey.trim()) {
      const envName =
        this.name === "xai" ? "XAI_API_KEY" : "AI_API_KEY";
      throw new Error(`${envName} is missing. Set it in your environment/.env.`);
    }

    const messages: any[] = [];
    
    if (options.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }

    const hasImages = parts.some((p) => !!p.image);
    const contentParts: any[] = parts.map((p) => {
      if (p.pdf) {
        throw new Error(
          "Native PDF parts are not supported by the OpenAI-compatible provider. Convert PDF files before sending them."
        );
      }
      if (p.image) {
        return {
          type: "image_url",
          image_url: {
            url: `data:${p.image.mimeType};base64,${p.image.base64}`,
          },
        };
      }
      return { type: "text", text: p.text || "" };
    });

    // Use plain string content for text-only messages — wider Ollama compatibility.
    const userContent: any = hasImages
      ? contentParts
      : contentParts.length === 1
        ? contentParts[0].text ?? ""
        : contentParts.map((c) => c.text ?? "").join("\n");

    messages.push({ role: "user", content: userContent });

    // Enable JSON mode for OpenAI-compatible providers (cloud + local Ollama).
    // xAI/Grok does not yet reliably support json_object mode, so it is excluded.
    const supportsJsonFormat =
      options.responseMimeType === "application/json" &&
      this.name !== "xai";

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: options.model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          response_format: supportsJsonFormat
            ? { type: "json_object" }
            : undefined,
        },
        {
          headers,
          timeout: this.timeoutMs,
        }
      );
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const summary = summarizeAxiosError(err);
      const providerLabel = this.name || "provider";
      if (status === 401 || status === 403) {
        throw new Error(`${providerLabel} auth error (${status}). ${summary}`);
      }
      if (status === 429) {
        throw new Error(`${providerLabel} rate limited (429). ${summary}`);
      }
      if (status && status >= 500) {
        throw new Error(`${providerLabel} server error (${status}). ${summary}`);
      }
      if (axios.isAxiosError(err) && (err.code === "ECONNABORTED" || /timeout/i.test(summary))) {
        throw new Error(`${providerLabel} request timeout. ${summary}`);
      }
      throw new Error(`${providerLabel} request failed. ${summary}`);
    }

    const result = response.data;
    const text = result?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`${this.name || "provider"} returned an empty response.`);
    }
    return {
      text,
      raw: result,
      usage: {
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        totalTokens: result.usage?.total_tokens || 0,
      },
    };
  }
}
