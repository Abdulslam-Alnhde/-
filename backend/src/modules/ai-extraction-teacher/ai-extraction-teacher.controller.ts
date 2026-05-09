import type { Context } from "hono";
import { runTeacherExtraction } from "./ai-extraction-teacher.service";

export async function extractTeacher(c: Context) {
  return runTeacherExtraction(c.req.raw);
}
