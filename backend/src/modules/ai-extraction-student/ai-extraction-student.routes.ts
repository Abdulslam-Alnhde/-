import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { extractStudent } from "./ai-extraction-student.controller";

export function registerAiExtractionStudentRoutes(
  app: Hono<{ Variables: { actor: ApiActor } }>
) {
  app.post("/services/extract-student", extractStudent);
  app.post("/extract-student", extractStudent);
}
