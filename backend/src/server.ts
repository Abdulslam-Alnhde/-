/** Node HTTP entry — AI + Prisma REST API for the Next.js BFF. */
import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

function loadDotEnvIfNeeded() {
  // Always load ALL .env candidates — the dev runner (preview tool) may
  // pre-inject only a few vars (e.g. DATABASE_URL, INTERNAL_API_SECRET)
  // while AI keys are only present in backend/.env.
  const candidates = [
    path.resolve(process.cwd(), "backend", ".env"), // workspace-root CWD → backend/.env
    path.resolve(process.cwd(), ".env"),             // backend CWD → backend/.env
    path.resolve(process.cwd(), "..", ".env"),       // fallback to parent .env
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let value = t.slice(eq + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Use !process.env[key] (not !(key in process.env)) so that
      // empty-string values pre-injected by the dev runner are overridden.
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadDotEnvIfNeeded();

// Startup diagnostics — shows which critical env vars are present (values hidden).
const _diag = {
  DATABASE_URL: !!process.env.DATABASE_URL,
  INTERNAL_API_SECRET: !!process.env.INTERNAL_API_SECRET,
  AI_PROVIDER: process.env.AI_PROVIDER || "(not set)",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `set (${process.env.GEMINI_API_KEY.slice(0, 8)}…)` : "MISSING",
  AI_API_KEY: process.env.AI_API_KEY ? `set (${process.env.AI_API_KEY.slice(0, 8)}…)` : "MISSING",
  EXTRACTION_PROVIDER: process.env.EXTRACTION_PROVIDER || "(not set)",
};
console.log("[server] ENV check:", JSON.stringify(_diag));

const port = Number(process.env.PORT) || 4000;
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`);
});
