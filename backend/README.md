# Backend (Hono + Prisma)

Runs the REST API on `PORT` (default **4000**). The Next.js app in `frontend/` proxies browser traffic here via the BFF using `INTERNAL_API_SECRET` and `x-user-*` headers.

## Cloud database setup

This project uses PostgreSQL through Prisma. For a shared setup, create a cloud PostgreSQL database such as Neon or Supabase, then put its connection strings in both `backend/.env` and `frontend/.env`:

- `DATABASE_URL`: pooled PostgreSQL URL
- `DIRECT_URL`: direct PostgreSQL URL

The frontend needs these variables because the NextAuth credentials callback queries Prisma on the server side. If only the backend points to the cloud database, login can still fail on a teammate's machine.

After setting the variables, run these from the project root:

```powershell
npm run db:generate
npm run db:push
npm run db:seed
```

## Commands

- `npm run dev` - `tsx watch src/server.ts`
- `npm run db:generate` - Prisma client
- `npm run db:push` - push Prisma schema to the database
- `npm run db:seed` - seed colleges and the initial admin user
- `npm run verify-ai` - check AI env in `backend/.env`

Copy `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL`, `INTERNAL_API_SECRET`, and AI keys.
