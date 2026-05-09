import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireRoles } from "@/common/guards";
import { forbidden, jsonError } from "@/common/http";
import type { ApiActor } from "@/common/types";
import { actingSubject } from "@/common/types";
import { canAdminPanelAction } from "@/lib/admin-user-actions";
import * as svc from "./profile-requests.service";

type Ctx = Context<{ Variables: { actor: ApiActor } }>;

export async function listProfileRequests(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "list")) return forbidden(c);
  try {
    const requests = await svc.listProfileRequestsAdmin();
    return c.json(requests);
  } catch {
    return jsonError(c, "تعذر جلب الطلبات", 500);
  }
}

export async function createProfileRequest(c: Ctx) {
  const actor = c.get("actor");
  try {
    const body = await c.req.json();
    const { userId, payload } = body;
    if (!userId || !payload || typeof payload !== "object") {
      return jsonError(c, "بيانات الطلب ناقصة", 400);
    }
    if (userId !== actor.userId) return jsonError(c, "غير مصرح", 403);
    const result = await svc.createProfileRequest({ userId, payload });
    if (!result.ok) {
      if (result.body)
        return c.json(result.body, result.status as ContentfulStatusCode);
      return jsonError(c, result.error, result.status);
    }
    return c.json({ success: true, request: result.request });
  } catch {
    return jsonError(c, "تعذر إنشاء الطلب", 500);
  }
}

export async function patchProfileRequest(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "edit")) return forbidden(c);
  const rid = c.req.param("id");
  if (!rid) return jsonError(c, "معرّف غير صالح", 400);
  const reviewerId = actor.userId;
  try {
    const { status, adminNote } = await c.req.json();
    const result = await svc.adminReviewProfileRequest({
      id: rid,
      reviewerId,
      status,
      adminNote,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json({ success: true, request: result.request });
  } catch {
    return jsonError(c, "تعذر تحديث الطلب", 500);
  }
}
