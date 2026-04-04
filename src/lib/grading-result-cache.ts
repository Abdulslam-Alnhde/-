import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { stableStringify } from "@/lib/stable-stringify";

const MAX_ENTRIES = 500;

/** تخزين في الذاكرة */
const store = new Map<string, string>();

const CACHE_FILE =
  process.env.GRADING_CACHE_FILE?.trim() ||
  join(process.cwd(), ".grading-cache.json");

let diskMerged = false;

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
    for (const [k, v] of store) obj[k] = v;
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
