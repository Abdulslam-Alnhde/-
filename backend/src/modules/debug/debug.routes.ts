import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { initAdminDebug } from "./debug.controller";

export function registerDebugRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.get("/debug/init-admin", initAdminDebug);
}
