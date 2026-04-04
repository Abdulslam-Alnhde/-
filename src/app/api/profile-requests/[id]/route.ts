import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireRole } from "@/lib/auth-server";
import { canAdminPanelAction } from "@/lib/admin-user-actions";

export const dynamic = "force-dynamic";

/** موافقة أو رفض المشرف */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "edit")) {
      return forbidden();
    }

    const reviewerId = gate.session!.user.id;

    const { status, adminNote } = await req.json();
    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const row = await prisma.profileChangeRequest.update({
      where: { id: params.id },
      data: {
        status,
        adminNote: typeof adminNote === "string" ? adminNote : null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (status === "APPROVED" && row.payload && typeof row.payload === "object") {
      const p = row.payload as Record<string, unknown>;
      await prisma.user.update({
        where: { id: row.userId },
        data: {
          ...(typeof p.name === "string" && { name: p.name }),
          ...(typeof p.phone === "string" && { phone: p.phone }),
          ...(typeof p.jobTitle === "string" && { jobTitle: p.jobTitle }),
          ...(typeof p.department === "string" && { department: p.department }),
        },
      });
    }

    return NextResponse.json({ success: true, request: row });
  } catch {
    return NextResponse.json(
      { error: "تعذر تحديث الطلب" },
      { status: 500 }
    );
  }
}
