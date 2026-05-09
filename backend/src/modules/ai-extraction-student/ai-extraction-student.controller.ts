import type { Context } from "hono";
import { handleExtractStudent } from "./ai-extraction-student.service";

export async function extractStudent(c: Context) {
  return handleExtractStudent(c.req.raw);
}
