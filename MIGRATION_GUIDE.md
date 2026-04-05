# Migration guide (monorepo split)

## Old → new paths

| Old path | New path |
|----------|----------|
| `package.json` (single Next app) | [package.json](package.json) (workspaces) + [frontend/package.json](frontend/package.json) + [backend/package.json](backend/package.json) |
| `prisma/*` | [backend/prisma/*](backend/prisma/) |
| `src/*` (Next app) | [frontend/src/*](frontend/src/) |
| `src/app/api/**` (thick handlers) | Logic: [backend/src/api/register-all.routes.ts](backend/src/api/register-all.routes.ts) + [backend/src/lib/*](backend/src/lib/); Proxies: [frontend/src/app/api/**/route.ts](frontend/src/app/api/) |
| `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `tsconfig.json` | Under [frontend/](frontend/) |
| `scripts/verify-ai-env.mjs` | [backend/scripts/verify-ai-env.mjs](backend/scripts/verify-ai-env.mjs) (reads `backend/.env`) |
| `src/lib/*` AI runners, `ai/`, `safe-json`, etc. | **Removed from frontend**; live only under [backend/src/lib/](backend/src/lib/) |
| `src/lib/support-mail.ts` | [backend/src/lib/support-mail.ts](backend/src/lib/support-mail.ts) only |

## Environment variables

Use **two** env files locally:

1. **`backend/.env`** — See [backend/.env.example](backend/.env.example): `DATABASE_URL`, `DIRECT_URL`, `PORT`, `INTERNAL_API_SECRET`, AI keys, optional SMTP, optional `DEBUG_INIT_ADMIN_SECRET`, optional `MEDIA_PUBLIC_ROOT`.
2. **`frontend/.env`** — See [frontend/.env.example](frontend/.env.example): `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `INTERNAL_API_URL` (e.g. `http://127.0.0.1:4000`), `INTERNAL_API_SECRET` (**same** as backend), `DATABASE_URL` / `DIRECT_URL` (needed for NextAuth `authorize` + Prisma).

Legacy single-repo **root `.env`**: copy relevant keys into both files above.

### Bootstrap / debug admin

The previous `/api/debug/init-admin` used a hard-coded DB URL and query secret. It is now:

- **BFF:** [frontend/src/app/api/debug/init-admin/route.ts](frontend/src/app/api/debug/init-admin/route.ts) forwards to the backend with **only** `INTERNAL_API_SECRET`.
- **Backend:** requires `DEBUG_INIT_ADMIN_SECRET` (query `?secret=`) plus optional `ADMIN_BOOTSTRAP_*` env vars — see [backend/.env.example](backend/.env.example).

## Import / code changes

- Frontend API routes import `@/lib/bff-proxy` (`bffProxy`, `bffToNextResponse`, `internalFetchOnly`).
- Backend uses `@/*` pointing at `backend/src/*`.
- `runTeacherExtraction` / `runGrading` now take Web **`Request`** and return **`Response`** (no `next/server`).

## How to run after pull

From the **repository root**:

```bash
# If installs fail on Windows, close IDE/antivirus locks on node_modules, then:
rimraf node_modules frontend/node_modules backend/node_modules package-lock.json
npm install
```

Generate Prisma client (backend):

```bash
npm run db:generate
```

Terminal 1 — API:

```bash
npm run dev -w backend
```

Terminal 2 — UI:

```bash
npm run dev -w frontend
```

Or one command:

```bash
npm run dev
```

Build (production):

```bash
npm run build
```

Seeding:

```bash
npm run db:seed
```

## Breaking / manual fixes

1. **Two processes** — The UI alone is not enough; the API must run for any `/api/*` data (except NextAuth).
2. **`INTERNAL_API_SECRET`** must be set and identical in frontend and backend.
3. **Uploaded support images** — Backend writes under `frontend/public/uploads` by default; ensure that directory exists and is writable.
4. **npm / path issues on Windows** — If `npm install` reports `EBUSY` / corrupted tarballs, delete all `node_modules`, clear `npm cache` if needed, retry when no process locks the folder.

## Frontend “modules” layout (optional follow-up)

The plan’s `frontend/src/modules/<feature>/components|hooks|...` layout can be adopted incrementally by moving files from `src/components` and `src/app/(dashboard)` without changing routes.
