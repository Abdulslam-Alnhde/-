# Frontend (Next.js 14)

Dashboard UI and **BFF** Route Handlers under `src/app/api/*` (except NextAuth). Proxies authenticated requests to `INTERNAL_API_URL` with `INTERNAL_API_SECRET`.

Copy `.env.example` to `.env`. Match `INTERNAL_API_SECRET` to the backend value. Set `NEXTAUTH_URL` / `NEXTAUTH_SECRET` for production.

## Commands

- `npm run dev` — Next on port 3000 (default)
- `npm run build` — runs `prisma generate --schema=../backend/prisma/schema.prisma` then `next build`
