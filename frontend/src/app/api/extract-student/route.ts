/** Legacy alias for `/api/services/extract-student` (BFF). */
import { bffProxy } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const formData = await req.formData();
  return bffProxy("/services/extract-student", {
    method: "POST",
    body: formData,
  });
}
