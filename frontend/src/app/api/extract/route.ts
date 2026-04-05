/** Legacy alias for `/api/services/extract-teacher` (BFF). */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const formData = await req.formData();
  return bffProxy("/services/extract-teacher", {
    method: "POST",
    body: formData,
  });
}
