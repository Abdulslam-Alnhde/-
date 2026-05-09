import "server-only";

/**
 * Models chain used by extraction/grading.
 *
 * Override via AI_MODELS="model1,model2,..."
 */
const RAW_MODELS = process.env.AI_MODELS?.split(",") ?? [
  "grok-4-1-fast-non-reasoning",
  "grok-4-1-fast-reasoning",
];

export const AI_MODELS: string[] = RAW_MODELS.map((s) => s.trim()).filter(Boolean);

export function visionModelsChain(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of AI_MODELS) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

export function gradingModelsChain(): string[] {
  const forced = process.env.AI_GRADING_MODEL?.trim();
  if (forced) return [forced];
  return visionModelsChain();
}

/**
 * Optional: Ollama model list for extraction (not used when AI_PROVIDER=xai).
 * Kept for backward compatibility with existing route imports.
 */
export function ollamaExtractModelsChain(): string[] {
  const raw = String(process.env.OLLAMA_EXTRACT_MODELS || "").trim();
  const models = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["llama3.2-vision", "llava", "llama3.2"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of models) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

