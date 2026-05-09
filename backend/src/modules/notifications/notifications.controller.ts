import type { Context } from "hono";
import { jsonError } from "@/common/http";
import type { ApiActor } from "@/common/types";
import * as svc from "./notifications.service";

type Ctx = Context<{ Variables: { actor: ApiActor } }>;

export async function listNotifications(c: Ctx) {
  const actor = c.get("actor");
  try {
    const notifications = await svc.listForUser(actor.userId);
    return c.json(notifications);
  } catch {
    return jsonError(c, "تعذر جلب التنبيهات", 500);
  }
}

export async function patchNotificationRead(c: Ctx) {
  const actor = c.get("actor");
  try {
    const body = await c.req.json();
    const result = await svc.markReadForUser({
      userId: actor.userId,
      notificationId: body.id,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to update notification" }, 500);
  }
}
