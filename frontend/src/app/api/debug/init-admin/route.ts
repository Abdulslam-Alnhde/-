/** BFF: optional admin bootstrap — forwards to backend (secret + env on server only). */
import { NextRequest } from "next/server";
import { bffToNextResponse, internalFetchOnly } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const path = q ? `/debug/init-admin?${q}` : "/debug/init-admin";
  const res = await internalFetchOnly(path, { method: "GET" });
  return bffToNextResponse(res);
}
