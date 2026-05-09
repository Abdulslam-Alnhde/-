/** Registers all JSON API routes under `/api` (Hono), after internal auth middleware. */
import { Hono } from "hono";
import { internalOnly } from "@/common/middleware/internal-auth.middleware";
import type { ApiActor } from "@/common/types";
import { registerAiExtractionStudentRoutes } from "@/modules/ai-extraction-student/ai-extraction-student.routes";
import { registerAiExtractionTeacherRoutes } from "@/modules/ai-extraction-teacher/ai-extraction-teacher.routes";
import { registerAiGradingRoutes } from "@/modules/ai-grading/ai-grading.routes";
import { registerCollegesRoutes } from "@/modules/colleges/colleges.routes";
import { registerDebugRoutes } from "@/modules/debug/debug.routes";
import { registerExamsRoutes } from "@/modules/exams/exams.routes";
import { registerNotificationsRoutes } from "@/modules/notifications/notifications.routes";
import { registerPermissionsRoutes } from "@/modules/permissions/permissions.routes";
import { registerProfileRequestsRoutes } from "@/modules/profile-requests/profile-requests.routes";
import { registerStatsRoutes } from "@/modules/stats/stats.routes";
import { registerSupportTicketsRoutes } from "@/modules/support-tickets/support-tickets.routes";
import { registerUsersRoutes } from "@/modules/users/users.routes";

export function registerAllRoutes(root: Hono) {
  const api = new Hono<{ Variables: { actor: ApiActor } }>();
  api.use("*", internalOnly);

  registerCollegesRoutes(api);
  registerPermissionsRoutes(api);
  registerUsersRoutes(api);
  registerProfileRequestsRoutes(api);
  registerSupportTicketsRoutes(api);
  registerNotificationsRoutes(api);
  registerExamsRoutes(api);
  registerStatsRoutes(api);
  registerAiExtractionTeacherRoutes(api);
  registerAiExtractionStudentRoutes(api);
  registerAiGradingRoutes(api);
  registerDebugRoutes(api);

  root.route("/api", api);
}
