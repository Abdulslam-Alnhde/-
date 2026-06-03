/** Node HTTP entry for the Next.js BFF backend API. */
import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

function loadDotEnvIfNeeded() {
  const candidates = [
    path.resolve(process.cwd(), "backend", ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
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
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadDotEnvIfNeeded();

const _diag = {
  DATABASE_URL: !!process.env.DATABASE_URL,
  INTERNAL_API_SECRET: !!process.env.INTERNAL_API_SECRET,
  AI_PROVIDER: process.env.AI_PROVIDER || "(not set)",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY
    ? `set (${process.env.GEMINI_API_KEY.slice(0, 8)}...)`
    : "MISSING",
  AI_MODELS: process.env.AI_MODELS || "(not set)",
};
console.log("[server] ENV check:", JSON.stringify(_diag));

const port = Number(process.env.PORT) || 4000;
const app = createApp();

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[server] Port ${port} is already in use. Stop the other "npm run dev" (or any process on :${port}), then restart once.\n` +
        `  Windows: Get-NetTCPConnection -LocalPort ${port} -State Listen | Select OwningProcess\n` +
        `  Then: taskkill /PID <pid> /F`
    );
    process.exit(1);
  }
  throw err;
});
