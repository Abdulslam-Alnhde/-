import axios from "axios";
import { AIProvider } from "../provider-interface";
import { AIContentPart, AIRequestOptions, AIResponse } from "../types";

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

function toXaiInput(parts: AIContentPart[]): Array<Record<string, unknown>> {
  // xAI Responses API uses OpenAI Responses-style message input.
  // See: https://docs.x.ai/developers/quickstart
  const content: Array<Record<string, unknown>> = [];
  for (const p of parts) {
    if (p.pdf) {
      // Our pipeline converts PDFs for OpenAI-compatible providers; keep invariant.
      throw new Error(
        "Native PDF parts are not supported for xAI in this app. Convert PDF files before sending them."
      );
    }
    if (p.image?.base64) {
      content.push({
        type: "input_image",
        image_url: `data:${p.image.mimeType};base64,${p.image.base64}`,
      });
      continue;
    }
    if (typeof p.text === "string") {
      const t = p.text;
      if (t) content.push({ type: "input_text", text: t });
    }
  }

  return [
    {
      role: "user",
      content: content.length ? content : [{ type: "input_text", text: "" }],
    },
  ];
}

function extractOutputText(raw: any): string {
  if (typeof raw?.output_text === "string" && raw.output_text.trim()) {
    return raw.output_text;
  }
  const out = raw?.output;
  if (Array.isArray(out)) {
    const chunks: string[] = [];
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) chunks.push(c.text);
      }
    }
    const joined = chunks.join("\n").trim();
    if (joined) return joined;
  }
  // Last resort: common OpenAI-compatible field.
  const msg = raw?.choices?.[0]?.message?.content;
  if (typeof msg === "string" && msg.trim()) return msg;
  return "";
}

export class XAIProvider implements AIProvider {
  readonly name = "xai";
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(apiKey: string, baseUrl = "https://api.x.ai/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = Math.max(
      15000,
      Math.min(900000, Number(process.env.AI_REQUEST_TIMEOUT_MS) || 300000)
    );
  }

  async generateContent(
    parts: AIContentPart[],
    options: AIRequestOptions
  ): Promise<AIResponse> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error("XAI_API_KEY is missing. Set it in your environment/.env.");
    }

    const input = toXaiInput([
      ...(options.systemInstruction
        ? [{ text: options.systemInstruction } satisfies AIContentPart]
        : []),
      ...parts,
    ]);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const body: Record<string, unknown> = {
      model: options.model,
      input,
      temperature: options.temperature,
      max_output_tokens: options.maxTokens,
      // Best-effort JSON mode for structured outputs.
      response_format:
        options.responseMimeType === "application/json"
          ? { type: "json_object" }
          : undefined,
    };

    let response;
    try {
      response = await axios.post(`${this.baseUrl}/responses`, body, {
        headers,
        timeout: this.timeoutMs,
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const summary = summarizeAxiosError(err);
      if (status === 401 || status === 403) {
        throw new Error(`xai auth error (${status}). ${summary}`);
      }
      if (status === 429) {
        throw new Error(`xai rate limited (429). ${summary}`);
      }
      if (status && status >= 500) {
        throw new Error(`xai server error (${status}). ${summary}`);
      }
      if (
        axios.isAxiosError(err) &&
        (err.code === "ECONNABORTED" || /timeout/i.test(summary))
      ) {
        throw new Error(`xai request timeout. ${summary}`);
      }
      throw new Error(`xai request failed. ${summary}`);
    }

    const raw = response.data;
    const text = extractOutputText(raw);
    if (!text.trim()) {
      throw new Error("xai returned an empty response.");
    }
    return {
      text,
      raw,
      usage: {
        promptTokens: Number(raw?.usage?.input_tokens ?? 0) || 0,
        completionTokens: Number(raw?.usage?.output_tokens ?? 0) || 0,
        totalTokens:
          (Number(raw?.usage?.input_tokens ?? 0) || 0) +
          (Number(raw?.usage?.output_tokens ?? 0) || 0),
      },
    };
  }
}

