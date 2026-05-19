/**
 * Validates AI env for the backend. Loads backend/.env.
 * Run: npm --prefix backend run verify-ai
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

if (!fs.existsSync(envPath)) {
  console.error("No .env file found in backend:", envPath);
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const provider = (process.env.AI_PROVIDER || "gemini").trim();
const serviceProviders = [
  process.env.EXTRACTION_PROVIDER,
  process.env.TEACHER_EXTRACTION_PROVIDER,
  process.env.STUDENT_EXTRACTION_PROVIDER,
  process.env.GRADING_PROVIDER,
]
  .filter(Boolean)
  .map((v) => String(v).trim());

const allProviders = [provider, ...serviceProviders];
const unsupported = allProviders.filter(
  (p) => !["gemini", "openai", "xai", "custom"].includes(p)
);
if (unsupported.length) {
  console.error(`Unsupported AI provider(s): ${unsupported.join(", ")}`);
  process.exit(1);
}

const aiApiKey = process.env.AI_API_KEY?.trim();
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const xaiApiKey = process.env.XAI_API_KEY?.trim();
const baseUrl = process.env.AI_BASE_URL?.trim();

function hasKeyFor(p) {
  if (p === "gemini") return Boolean(geminiApiKey || aiApiKey);
  if (p === "xai") return Boolean(xaiApiKey || aiApiKey);
  if (p === "openai") return Boolean(aiApiKey);
  if (p === "custom") return Boolean(aiApiKey && baseUrl);
  return false;
}

for (const p of allProviders) {
  if (!hasKeyFor(p)) {
    if (p === "gemini") console.error("Set GEMINI_API_KEY or AI_API_KEY for Gemini.");
    else if (p === "xai") console.error("Set XAI_API_KEY or AI_API_KEY for xAI.");
    else if (p === "openai") console.error("Set AI_API_KEY for OpenAI.");
    else if (p === "custom") console.error("Set AI_API_KEY and AI_BASE_URL for the custom provider.");
    process.exit(1);
  }
}

console.log(`AI provider: ${provider}`);
console.log("AI env looks ready.");
