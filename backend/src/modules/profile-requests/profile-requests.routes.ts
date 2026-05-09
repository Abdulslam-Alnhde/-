import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import {
  createProfileRequest,
  listProfileRequests,
  patchProfileRequest,
} from "./profile-requests.controller";

export function registerProfileRequestsRoutes(
  app: Hono<{ Variables: { actor: ApiActor } }>
) {
  app.get("/profile-requests", listProfileRequests);
  app.post("/profile-requests", createProfileRequest);
  app.patch("/profile-requests/:id", patchProfileRequest);
}
