# RiRu Phase 1

Implemented on branch `riru-phase-1`. The Next.js app stays at the repository root.

Phase 2 later replaced the scan screen. This file describes what Phase 1 built. The scan-screen sentence below is historical.

`main` was not merged. Those commits replace this app with a Vite frontend and a Flask OCR script that saves uploads under the original file name. That conflicts with this deploy and with the photo rules. OCR belongs in Phase 3, inside `services/ml`, without writing the photo to disk.

## What works

- `migrate.js` applies `db/phase1.sql` on top of the existing Facelab tables. It does not drop columns. Re-running it is safe.
- The demo user `00000000-0000-4000-8000-000000000001` is marked `auth_provider = demo` so idle-guest deletion cannot remove it.
- `DEMO_MODE=true` keeps today's shared demo. This is what `zerops.yaml` sets, so a deploy does not switch the live stage to guest accounts until `SESSION_SECRET` exists and `DEMO_MODE` is changed to `false`.
- `DEMO_MODE` unset or `false` gives each browser its own guest row, an httpOnly cookie named `riru_session`, a profile, and prefs. The cookie value is not stored. The database stores a hash peppered with `SESSION_SECRET`.
- New guests from one IP are capped at 20 per database day. Missing `X-Forwarded-For` skips that cap rather than blocking every visitor that shares an empty address.
- Idle guests older than `GUEST_RETENTION_DAYS` (default 30) are deleted at the end of each migration, and a `deletion_receipts` row is written with a random id and no profile fields.
- Legacy `/api/scans`, `/api/chat`, `/api/plan`, `/api/prefs`, `/api/dashboard`, and `/api/scans/*` use the session user. Guest face scans are limited to 8 per day. Guest chat and plan calls share a limit of 30 per hour. Demo mode is not limited.
- `GET /api/health` still returns HTTP 200. The body adds `ml`: `ok`, `unconfigured`, `unauthorized`, or `unreachable`. Zerops readiness stays on `GET /`.
- `getStorage()` discards bytes when `STORAGE_PROVIDER` is `none` or unset. `supabase` uploads only when URL, service role key, and bucket are set. `s3` returns `STORAGE_PROVIDER_UNSUPPORTED` and does not write a file.
- `services/ml` answers `GET /internal/v1/health` when `Authorization: Bearer $ML_SERVICE_TOKEN` matches. It does not analyze a face.
- `packages/shared` exports the disclaimer and the zod error and session schemas.
- `prisma/schema.prisma` matches the target tables. The app still queries through `pg`. Prisma Client is not in the request path, because the Zerops standalone image does not yet trace the Prisma query engine.

## What is not implemented

- No face mesh, quality gate, OCR, rules engine, routine builder, price fetch, RAG, or recovery mode.
- No account login.
- The scan screen still stores heuristic scores from `lib/scan-engine.ts`. The home page says those scores are sample estimates.
- S3 is not implemented.
- There is no daily timer inside the web process. Guest purge runs when `node migrate.js` runs, which on Zerops is once per deploy version.
- A strict Content-Security-Policy is not set. Next.js needs inline scripts, and a policy of `default-src 'self'` would break the current UI. `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and a camera permission policy are set.
- ESLint and Prettier are not configured for the existing UI. CI typechecks the TypeScript and runs Ruff on the Python service.
- pgvector on Zerops is unverified. If `CREATE EXTENSION vector` fails, the migration continues and `schema_flags.vector_available` is false. Embeddings then use `embedding_fallback double precision[]` only.

## Commands

Install and check, from the repo root:

```powershell
npm ci
npm run typecheck
npm test
$env:DATABASE_URL = "postgresql://riru:riru@localhost:5432/riru"
npm run prisma:validate
pip install -r services/ml/requirements-dev.txt
ruff check services/ml
pytest services/ml
```

Local stack (Docker):

```powershell
docker compose up --build
```

Web: http://localhost:3000  
ML health from inside the compose network: `GET http://ml:8000/internal/v1/health` with the dev token in `docker-compose.yml`.

Apply the schema against a database you already have:

```powershell
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_USER = "riru"
$env:DB_PASS = "riru"
$env:DB_NAME = "riru"
npm run migrate
```

Environment names are listed in `.env.example`. Production guest mode also needs `SESSION_SECRET` of at least 16 characters. Demo mode does not.

## Files

```text
db/phase1.sql
prisma/schema.prisma
lib/session-token.ts
lib/actor.ts
lib/guests.ts
lib/rate-limit.ts
lib/storage.ts
app/api/v1/session/route.ts
app/api/health/route.ts
app/layout.tsx
app/page.tsx
components/SessionGate.tsx
packages/shared/
services/ml/
data/ingredients|rules/v1|routines|products|knowledge
docker-compose.yml
.env.example
.github/workflows/ci.yml
tests/
zerops.yaml
migrate.js
scripts/bundle-migrate.mjs
next.config.ts
package.json
```

Existing scan, chat, prefs, plan, and dashboard routes now take the actor id instead of the hardcoded demo id.
