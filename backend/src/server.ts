/** Node HTTP entry — AI + Prisma REST API for the Next.js BFF. */
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT) || 4000;
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`);
});
