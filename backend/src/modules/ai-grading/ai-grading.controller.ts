import type { Context } from "hono";
import { runGrading } from "./ai-grading.service";

export async function gradeAnswers(c: Context) {
  return runGrading(c.req.raw);
}
