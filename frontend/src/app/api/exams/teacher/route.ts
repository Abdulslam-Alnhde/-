/** BFF: teacher exams list via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/exams/teacher", { method: "GET" });
}
