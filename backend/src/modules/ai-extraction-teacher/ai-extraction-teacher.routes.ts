import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import { extractTeacher } from "./ai-extraction-teacher.controller";

export function registerAiExtractionTeacherRoutes(
  app: Hono<{ Variables: { actor: ApiActor } }>
) {
  app.post("/services/extract-teacher", extractTeacher);
  app.post("/extract", extractTeacher);
}
