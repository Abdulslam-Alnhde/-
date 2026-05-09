import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireAuth, requireRole } from "@/lib/auth-server";
import { canAdminPanelAction } from "@/lib/admin-user-actions";

export const dynamic = "force-dynamic";

/** قائمة الطلبات (للمشرف) */
export async function GET() {
  try {
    const gate = await requireRole(["ADMIN"]);
    if (gate.error) return gate.error;
    if (!gate.user || !canAdminPanelAction(gate.user, "list")) {
      return forbidden();
    }

    const requests = await prisma.profileChangeRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employeeCode: true,
          },
        },
      },
    });

    return NextResponse.json(requests);
  } catch {
    return NextResponse.json(
      { error: "تعذر جلب الطلبات" },
      { status: 500 }
    );
  }
}

/** موظف يرسل طلب تعديل بيانات */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const body = await req.json();
    const { userId, payload } = body;

    if (!userId || !payload || typeof payload !== "object") {
      return NextResponse.json(
        { error: "بيانات الطلب ناقصة" },
        { status: 400 }
      );
    }

    if (userId !== auth.session!.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }
    if (!user.profileLocked) {
      return NextResponse.json(
        {
          error:
            "حسابك غير مقفل — عدّل بياناتك مباشرة من صفحة الإعدادات",
        },
        { status: 400 }
      );
    }

    const reqRow = await prisma.profileChangeRequest.create({
      data: {
        userId,
        payload,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, request: reqRow });
  } catch {
    return NextResponse.json(
      { error: "تعذر إنشاء الطلب" },
      { status: 500 }
    );
  }
}
