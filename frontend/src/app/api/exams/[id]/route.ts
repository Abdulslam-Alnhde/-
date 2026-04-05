/** BFF: single exam read/resubmit via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return bffProxy(`/exams/${params.id}`, { method: "GET" });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.text();
  return bffProxy(`/exams/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
