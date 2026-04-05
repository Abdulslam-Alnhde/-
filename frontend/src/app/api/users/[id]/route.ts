/** BFF: admin user update/delete via the backend API. */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.text();
  return bffProxy(`/users/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return bffProxy(`/users/${params.id}`, { method: "DELETE" });
}
