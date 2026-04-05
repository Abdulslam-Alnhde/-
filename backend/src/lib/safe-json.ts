/**
 * مساعدات مشتركة لقراءة JSON من ردود نماذج الذكاء الاصطناعي.
 * تتجاهل علامات Markdown وعلامات `<think>`/`<analysis>` الشائعة،
 * ثم تستخرج أوّل كتلة JSON متّزنة الأقواس.
 */

export function stripJsonWrappers(rawResponse: string): string {
  return String(rawResponse ?? "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .trim();
}

export function findFirstJsonBlock(text: string): string | null {
  const source = stripJsonWrappers(text);
  for (let i = 0; i < source.length; i += 1) {
    const opener = source[i];
    if (opener !== "{" && opener !== "[") continue;
    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === opener) depth += 1;
      else if (ch === closer) {
        depth -= 1;
        if (depth === 0) return source.slice(i, j + 1).trim();
      }
    }
  }
  return null;
}

export function parsePossiblyWrappedJson(
  rawResponse: string,
  errorMessage = "No valid JSON block was found in the model response."
): any {
  const cleanResponse = stripJsonWrappers(rawResponse);

  const tryParse = (candidate: string) => {
    const parsed = JSON.parse(candidate);
    if (typeof parsed === "string") return JSON.parse(parsed);
    return parsed;
  };

  if (
    (cleanResponse.startsWith("{") && cleanResponse.endsWith("}")) ||
    (cleanResponse.startsWith("[") && cleanResponse.endsWith("]"))
  ) {
    try {
      return tryParse(cleanResponse);
    } catch {
      // fall through
    }
  }

  const jsonBlock = findFirstJsonBlock(cleanResponse);
  if (!jsonBlock) throw new Error(errorMessage);

  try {
    return tryParse(jsonBlock);
  } catch {
    throw new Error(errorMessage);
  }
}
