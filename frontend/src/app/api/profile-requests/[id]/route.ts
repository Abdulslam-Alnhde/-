/** BFF: approve/reject profile change via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.text();
  return bffProxy(`/profile-requests/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
