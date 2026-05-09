import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { gradeAnswers } from "./ai-grading.controller";

export function registerAiGradingRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.post("/services/grading", gradeAnswers);
  app.post("/grade", gradeAnswers);
}
