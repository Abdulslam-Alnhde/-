/** BFF: profile change requests via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/profile-requests", { method: "GET" });
}

export async function POST(req: Request) {
  const body = await req.text();
  return bffProxy("/profile-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
