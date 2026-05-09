import { Hono } from "hono";
import type { ApiActor } from "@/common/types";
import {
  createSupportTicket,
  listSupportTickets,
  patchSupportTicket,
} from "./support-tickets.controller";

export function registerSupportTicketsRoutes(
  app: Hono<{ Variables: { actor: ApiActor } }>
) {
  app.get("/support-tickets", listSupportTickets);
  app.post("/support-tickets", createSupportTicket);
  app.patch("/support-tickets/:id", patchSupportTicket);
}
