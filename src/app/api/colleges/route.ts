import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireRole } from "@/lib/auth-server";
import { canAdminPanelAction } from "@/lib/admin-user-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "list")) {
      return forbidden();
    }

    const colleges = await prisma.college.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(colleges);
  } catch {
    return NextResponse.json(
      { error: "تعذر جلب الكليات" },
      { status: 500 }
    );
  }
}
