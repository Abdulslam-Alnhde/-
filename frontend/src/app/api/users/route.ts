/** BFF: admin user list/create via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/users", { method: "GET" });
}

export async function POST(req: Request) {
  const body = await req.text();
  return bffProxy("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
