/**
 * Validates AI env for the backend. Loads backend/.env
 * Run: npm run verify-ai -w backend
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

if (!fs.existsSync(envPath)) {
  console.error("لا يوجد ملف .env في مجلد backend:", envPath);
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

const provider = (process.env.AI_PROVIDER || "xai").trim();
const aiApiKey = process.env.AI_API_KEY?.trim();
const xaiApiKey = process.env.XAI_API_KEY?.trim();
const baseUrl = process.env.AI_BASE_URL?.trim();

if (provider === "xai") {
  if (!xaiApiKey && !aiApiKey) {
    console.error("ضع XAI_API_KEY أو AI_API_KEY لاستخدام xAI (Grok).");
    process.exit(1);
  }
  console.log("xAI (Grok): تم العثور على مفتاح API.");
} else if (provider === "openai") {
  if (!aiApiKey) {
    console.error("ضع AI_API_KEY لاستخدام OpenAI.");
    process.exit(1);
  }
  console.log("OpenAI: تم العثور على مفتاح API.");
} else if (provider === "custom") {
  if (!aiApiKey || !baseUrl) {
    console.error("ضع AI_API_KEY و AI_BASE_URL لاستخدام المزود المخصص.");
    process.exit(1);
  }
  console.log("Custom API: تم العثور على AI_API_KEY و AI_BASE_URL.");
} else {
  console.error(`AI_PROVIDER="${provider}" غير معروف أو ينقصه الإعداد الصحيح.`);
  process.exit(1);
}

console.log(`مزود التشغيل الحالي: ${provider}`);
