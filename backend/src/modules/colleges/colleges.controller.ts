/** Colleges controller — HTTP layer for colleges endpoints. */
import type { Context } from "hono";
import { listColleges } from "./colleges.service";
import { requireRoles } from "@/common/guards";
import { actingSubject } from "@/common/types";
import { forbidden, jsonError } from "@/common/http";
import { canAdminPanelAction } from "@/lib/admin-user-actions";

export async function getColleges(c: Context) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;

  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "list")) return forbidden(c);

  try {
    const colleges = await listColleges();
    return c.json(colleges);
  } catch {
    return jsonError(c, "تعذر جلب الكليات", 500);
  }
}

