import type { Context } from "hono";
import * as svc from "./debug.service";

export async function initAdminDebug(c: Context) {
  const secret = c.req.query("secret");
  const expected = process.env.DEBUG_INIT_ADMIN_SECRET;
  if (!expected || secret !== expected) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const result = await svc.bootstrapAdminAccount();
    if (!result.ok) return c.json({ error: result.error }, 500);
    return c.json({
      success: true,
      message: "تم إنشاء/تحديث حساب المشرف.",
      user: result.employeeCode,
    });
  } catch (error: unknown) {
    return c.json({ error: (error as Error).message }, 500);
  }
}
