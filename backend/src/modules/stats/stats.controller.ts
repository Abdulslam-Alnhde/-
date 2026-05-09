import type { Context } from "hono";
import { requireRoles } from "@/common/guards";
import { forbidden, jsonError } from "@/common/http";
import type { ApiActor } from "@/common/types";
import { actingSubject } from "@/common/types";
import { canAdminPanelAction } from "@/lib/admin-user-actions";
import * as svc from "./stats.service";

type Ctx = Context<{ Variables: { actor: ApiActor } }>;

export async function getAdminStats(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["ADMIN"]);
  if (gate) return gate;
  const subj = actingSubject(actor);
  if (!canAdminPanelAction(subj, "list")) return forbidden(c);
  try {
    const data = await svc.adminDashboardStats();
    return c.json(data);
  } catch {
    return jsonError(c, "Failed to fetch admin stats", 500);
  }
}

export async function getCommitteeStats(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["COMMITTEE"]);
  if (gate) return gate;
  try {
    const data = await svc.committeeDashboardStats();
    return c.json(data);
  } catch {
    return c.json(
      {
        stats: { pending: 0, approved: 0, rejected: 0, totalReviewed: 0 },
        recentActivity: [],
        error: "تعذّر جلب إحصائيات اللجنة",
      },
      500
    );
  }
}
