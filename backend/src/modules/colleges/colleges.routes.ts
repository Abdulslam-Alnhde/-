/** Colleges routes — mounts endpoints on the internal API. */
import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { getColleges } from "./colleges.controller";

export function registerCollegesRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.get("/colleges", getColleges);
}
