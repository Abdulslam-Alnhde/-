/** Legacy alias for `/api/services/grading` (BFF). */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  return bffProxy("/services/grading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
