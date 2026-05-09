import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { getAdminStats, getCommitteeStats } from "./stats.controller";

export function registerStatsRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.get("/admin/stats", getAdminStats);
  app.get("/committee/stats", getCommitteeStats);
}
