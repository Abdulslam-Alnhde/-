/** Permissions routes — mounts endpoints on the internal API. */
import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { getPermissions } from "./permissions.controller";

export function registerPermissionsRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.get("/permissions", getPermissions);
}
