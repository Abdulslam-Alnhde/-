import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { listNotifications, patchNotificationRead } from "./notifications.controller";

export function registerNotificationsRoutes(
  app: Hono<{ Variables: { actor: ApiActor } }>
) {
  app.get("/notifications", listNotifications);
  app.patch("/notifications", patchNotificationRead);
}
