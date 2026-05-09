/** Permissions controller — returns permission catalog for authenticated sessions. */
import type { Context } from "hono";
import { listPermissions } from "./permissions.service";

export async function getPermissions(c: Context) {
  // Internal auth already ensured; any logged-in user can view the catalog.
  return c.json(listPermissions());
}
