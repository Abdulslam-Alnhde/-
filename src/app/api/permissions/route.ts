import { NextResponse } from "next/server";
import { PERMISSION_KEYS, PERMISSION_LABELS_AR } from "@/lib/permissions";
import { requireAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const list = Object.values(PERMISSION_KEYS).map((key) => ({
    key,
    labelAr: PERMISSION_LABELS_AR[key] || key,
  }));
  return NextResponse.json(list);
}
