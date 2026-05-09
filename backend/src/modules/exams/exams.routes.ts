import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import {
  approveExam,
  finalizeExam,
  getTeacherExam,
  listPendingExams,
  listTeacherExams,
  patchTeacherExamResubmit,
} from "./exams.controller";

export function registerExamsRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.get("/exams/teacher", listTeacherExams);
  app.get("/exams/pending", listPendingExams);
  app.post("/exams/finalize", finalizeExam);
  app.post("/exams/approve", approveExam);
  app.get("/exams/:id", getTeacherExam);
  app.patch("/exams/:id", patchTeacherExamResubmit);
}
