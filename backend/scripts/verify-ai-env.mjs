/**
 * Validates Google Gemini env for the backend.
 * Run: npm --prefix backend run verify-ai
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", "..", ".env"),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (!envPath) {
  console.error("No .env file found for the backend.");
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

const provider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
if (provider !== "gemini") {
  console.error(`Unsupported AI_PROVIDER: ${provider}. Use gemini.`);
  process.exit(1);
}

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
if (!geminiApiKey || geminiApiKey === "YOUR_GOOGLE_GEMINI_API_KEY_HERE") {
  console.error("Set GEMINI_API_KEY for Google Gemini.");
  process.exit(1);
}

console.log("AI provider: gemini");
console.log("AI env looks ready.");
