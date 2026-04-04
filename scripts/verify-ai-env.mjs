/**
 * يتحقق من إعداد LOCAL_LLM أو GEMINI.
 * التشغيل: npm run verify-ai
 * أو: node scripts/verify-ai-env.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

if (!fs.existsSync(envPath)) {
  console.error("لا يوجد ملف .env في جذر المشروع:", envPath);
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

const local = process.env.LOCAL_LLM_BASE_URL?.trim();
const gemini = process.env.GEMINI_API_KEY?.trim();

if (local) {
  const base = local.replace(/\/$/, "");
  const modelsUrl = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
  console.log("اختبار الخادم المحلي:", modelsUrl);
  try {
    const res = await fetch(modelsUrl);
    console.log("→ HTTP", res.status, res.ok ? "(يستجيب)" : "");
  } catch (e) {
    console.warn("تعذر الاتصال:", e instanceof Error ? e.message : e);
  }
}

if (gemini?.startsWith("AIza")) {
  console.log("Gemini: مفتاح Google موجود (التنسيق صحيح).");
  try {
    const u = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(gemini)}`;
    const res = await fetch(u, { method: "GET" });
    const ok = res.ok;
    console.log("→ اختبار الاتصال بـ generativelanguage.googleapis.com: HTTP", res.status, ok ? "(نجح)" : "");
    if (!ok) {
      const t = await res.text();
      console.warn("رد الخادم (مختصر):", t.slice(0, 300));
    }
  } catch (e) {
    console.error(
      "→ فشل الاتصال بخوادم Google (fetch failed / شبكة / جدار ناري / DNS):",
      e instanceof Error ? e.message : e
    );
    console.error(
      "  جرّب: التحقق من الإنترنت، تعطيل VPN مؤقتاً، أو على Windows أحياناً: set NODE_OPTIONS=--dns-result-order=ipv4first"
    );
  }
} else if (!local) {
  console.error("ضع LOCAL_LLM_BASE_URL أو GEMINI_API_KEY (يبدأ بـ AIza)");
  process.exit(1);
}

if (local) {
  console.log("الأولوية عند التشغيل: النموذج المحلي (Gemma/Ollama إلخ).");
} else {
  console.log("الأولوية عند التشغيل: Google Gemini.");
}
