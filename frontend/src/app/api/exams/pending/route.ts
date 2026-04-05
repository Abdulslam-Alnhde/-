/** BFF: committee pending exams via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/exams/pending", { method: "GET" });
}
