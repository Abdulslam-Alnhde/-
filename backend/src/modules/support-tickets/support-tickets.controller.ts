import type { Context } from "hono";
import { requireRoles } from "@/common/guards";
import { jsonError } from "@/common/http";
import type { ApiActor } from "@/common/types";
import { actingSubject } from "@/common/types";
import * as svc from "./support-tickets.service";

type Ctx = Context<{ Variables: { actor: ApiActor } }>;

export async function listSupportTickets(c: Ctx) {
  const actor = c.get("actor");
  try {
    if (actor.role === "ADMIN") {
      const gate = requireRoles(c, actor, ["ADMIN"]);
      if (gate) return gate;
    }
    const tickets = await svc.listSupportTicketsForActor(actor.userId, actor.role);
    return c.json(tickets);
  } catch {
    return jsonError(c, "تعذر جلب طلبات الدعم", 500);
  }
}

export async function createSupportTicket(c: Ctx) {
  const actor = c.get("actor");
  try {
    const form = await c.req.formData();
    const result = await svc.createSupportTicketWithUploads({
      userId: actor.userId,
      form,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json(result.ticket);
  } catch (e) {
    console.error("support-tickets POST", e);
    return jsonError(c, "تعذر إرسال الطلب", 500);
  }
}

export async function patchSupportTicket(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const admin = actingSubject(actor);
  const id = c.req.param("id");
  if (!id) return jsonError(c, "معرّف غير صالح", 400);
  try {
    const body = await c.req.json();
    const reply = typeof body.adminReply === "string" ? body.adminReply.trim() : "";
    const result = await svc.adminReplyToTicket({
      ticketId: id,
      adminId: admin.id,
      reply,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json(result.ticket);
  } catch (e) {
    console.error("support-tickets PATCH", e);
    return jsonError(c, "تعذر حفظ الرد", 500);
  }
}
