/** BFF: support tickets via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/support-tickets", { method: "GET" });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  return bffProxy("/support-tickets", { method: "POST", body: formData });
}
