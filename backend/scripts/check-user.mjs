import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "..", ".env"), path.resolve(here, "..", "..", ".env")];
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
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    if (process.env.DATABASE_URL) return;
  }
}

loadDotEnvIfNeeded();

import { prisma } from "../dist/lib/prisma.js";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/check-user.mjs <email>");
  process.exit(2);
}

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });
  if (!user) {
    console.log(JSON.stringify({ ok: true, found: false, email }));
  } else {
    console.log(
      JSON.stringify({
        ok: true,
        found: true,
        email: user.email,
        id: user.id,
        role: user.role,
        hasPasswordHash: Boolean(user.passwordHash),
      })
    );
  }
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

