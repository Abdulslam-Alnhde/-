/** Users routes — mounts endpoints on the internal API. */
import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminPatchUser,
  getMe,
  patchMe,
} from "./users.controller";

export function registerUsersRoutes(app: Hono<{ Variables: { actor: ApiActor } }>) {
  app.get("/users/me", getMe);
  app.patch("/users/me", patchMe);

  app.get("/users", adminListUsers);
  app.post("/users", adminCreateUser);
  app.patch("/users/:id", adminPatchUser);
  app.delete("/users/:id", adminDeleteUser);
}
