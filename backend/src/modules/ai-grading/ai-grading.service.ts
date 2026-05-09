import { runGrading as runGradingRunner } from "@/lib/grading-runner";

export async function runGrading(req: Request): Promise<Response> {
  return runGradingRunner(req);
}
