import { runTeacherExtraction as runTeacherExtractionRunner } from "@/lib/extract-teacher-runner";

export async function runTeacherExtraction(req: Request): Promise<Response> {
  return runTeacherExtractionRunner(req);
}
