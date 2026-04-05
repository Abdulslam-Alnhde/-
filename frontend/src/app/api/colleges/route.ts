/** BFF: proxies college list to the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/colleges", { method: "GET" });
}
