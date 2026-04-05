# Backend (Hono + Prisma)

Runs the REST API on `PORT` (default **4000**). The Next.js app in `frontend/` proxies browser traffic here via the BFF using `INTERNAL_API_SECRET` and `x-user-*` headers.

## Commands

- `npm run dev` — `tsx watch src/server.ts`
- `npm run db:generate` — Prisma client
- `npm run db:seed` — seed database
- `npm run verify-ai` — check AI env in `backend/.env`

Copy `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL`, `INTERNAL_API_SECRET`, and AI keys.
