/** Verifies INTERNAL_API_SECRET and loads the acting user from x-user-* headers. */
import { createMiddleware } from "hono/factory";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import type { ApiActor } from "@/common/types";

export const internalOnly = createMiddleware<{
  Variables: { actor: ApiActor };
}>(async (c, next) => {
  const secret = c.req.header("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected || secret !== expected) {
    return c.json({ error: "غير مصرح" }, 401);
  }

  const p = c.req.path;
  const isDebugInit =
    p.includes("debug/init-admin") && c.req.method === "GET";

  if (!isDebugInit) {
    const userId = c.req.header("x-user-id")?.trim();
    const role = c.req.header("x-user-role") as Role | undefined;
    const keysRaw = c.req.header("x-user-permission-keys") ?? "";
    if (!userId || !role) {
      return c.json({ error: "يجب تسجيل الدخول" }, 401);
    }

    const permissionKeys = keysRaw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });

    c.set("actor", {
      userId,
      role,
      permissionKeys,
      dbUser,
    });
  } else {
    c.set("actor", {
      userId: "",
      role: "TEACHER" as Role,
      permissionKeys: [],
      dbUser: null,
    });
  }
  await next();
});
