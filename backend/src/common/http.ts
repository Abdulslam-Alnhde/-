/** HTTP helpers mirroring previous NextResponse patterns. */
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonError(c: Context, message: string, status: number) {
  return c.json({ error: message }, status as ContentfulStatusCode);
}

export function unauthorized(c: Context) {
  return c.json({ error: "يجب تسجيل الدخول" }, 401);
}

export function forbidden(c: Context) {
  return c.json({ error: "ليس لديك صلاحية" }, 403);
}
