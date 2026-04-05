import "server-only";

import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const MAX_ENTRIES = 500;
const store = new Map<string, string>();

const CACHE_FILE =
  process.env.GRADING_CACHE_FILE?.trim() ||
  join(process.cwd(), ".grading-cache.json");

let diskMerged = false;

/** ترتيب مفاتيح JSON بشكل حتمي — نفس الكائن ينتج نفس السلسلة (لمفتاح التخزين المؤقت). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function mergeDiskIntoMemory() {
  if (diskMerged) return;
  diskMerged = true;
  try {
    if (!existsSync(CACHE_FILE)) return;
    const raw = readFileSync(CACHE_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, string>;
    if (!data || typeof data !== "object") return;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string" && !store.has(k)) store.set(k, v);
    }
  } catch (e) {
    console.warn("[grading-cache] تعذر تحميل الملف:", e);
  }
}

function persistToDisk() {
  try {
    const dir = dirname(CACHE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const obj: Record<string, string> = {};
    for (const [k, v] of Array.from(store.entries())) obj[k] = v;
    writeFileSync(CACHE_FILE, JSON.stringify(obj), "utf8");
  } catch (e) {
    console.warn("[grading-cache] تعذر حفظ الملف:", e);
  }
}

export function gradingCacheKey(payload: unknown): string {
  return createHash("sha256")
    .update(stableStringify(payload), "utf8")
    .digest("hex");
}

export function getCachedGradingJson(key: string): unknown | null {
  mergeDiskIntoMemory();
  const raw = store.get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function setCachedGradingJson(key: string, body: unknown): void {
  mergeDiskIntoMemory();
  const serialized = JSON.stringify(body);
  if (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value as string | undefined;
    if (first !== undefined) store.delete(first);
  }
  store.set(key, serialized);
  persistToDisk();
}
