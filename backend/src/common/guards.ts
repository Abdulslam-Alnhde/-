/** Role checks for route handlers (authorization after internal auth). */
import type { Context } from "hono";
import type { Role } from "@prisma/client";
import type { ApiActor } from "@/common/types";
import { forbidden } from "@/common/http";

export function requireRoles(
  c: Context,
  actor: ApiActor,
  allowed: Role[]
): ReturnType<typeof forbidden> | null {
  if (!allowed.includes(actor.role)) {
    return forbidden(c);
  }
  return null;
}
