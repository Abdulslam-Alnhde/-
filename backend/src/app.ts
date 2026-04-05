/** Hono application root (API mounted under `/api`). */
import { Hono } from "hono";
import { registerAllRoutes } from "@/api/register-all.routes";

export function createApp() {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));
  registerAllRoutes(app);
  return app;
}
