/** BFF: committee approve/reject exam via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  return bffProxy("/exams/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
