/** BFF: notifications via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/notifications", { method: "GET" });
}

export async function PATCH(req: Request) {
  const body = await req.text();
  return bffProxy("/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
