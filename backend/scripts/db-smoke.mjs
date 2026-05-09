import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", ".env"),
    path.resolve(here, "..", "..", ".env"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    if (process.env.DATABASE_URL) return;
  }
}

loadDotEnvIfNeeded();

import { prisma } from "../dist/lib/prisma.js";

try {
  const users = await prisma.user.count();
  console.log(JSON.stringify({ ok: true, users }));
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
