/** BFF: proxies permission metadata to the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  return bffProxy("/permissions", { method: "GET" });
}
