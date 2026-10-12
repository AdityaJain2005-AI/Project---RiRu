# RiRu Phase 0 — architecture contract

Status: design only. Nothing in this folder is wired into the running app.

Read this first, then:

| Document | What it decides |
|---|---|
| [architecture.md](architecture.md) | System shape, repo layout, request flows, ML plan, privacy |
| [data-model.md](data-model.md) | Tables, migration from the live `migrate.js` schema, indexes |
| [schema.prisma](schema.prisma) | Target Prisma schema. Not applied. Not a migration. |
| [openapi.yaml](openapi.yaml) | Public `/api/v1` contract |
| [risks.md](risks.md) | Risks, licenses we have not verified, rejected options |
| [model-card.md](model-card.md) | Model card template. No model is trained. No accuracy numbers. |

The product name going forward is **RiRu**. The deployed app still calls itself Facelab. Renaming the UI is a later phase. The Git remote stays `https://github.com/AdityaJain2005-AI/Project---RiRu.git`. The working copy is `Project---RiRu` on branch `frontend`. `Project---RiRu.git` is a bare mirror of the same remote. Work happens in the working copy.

## What already runs

Kept as the base. Phase 1 does not throw it away.

- Next.js 16 App Router, React 19, TypeScript, Tailwind, deployed on Zerops (`zerops.yaml`).
- PostgreSQL sibling. Connection env: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
- Idempotent SQL in `migrate.js`, run once per deploy via `zsc execOnce`.
- Tables today: `greetings`, `users`, `skin_scans`, `chat_messages`, `user_prefs`, `notifications`.
- One hardcoded user, `DEMO_USER_ID` (`00000000-0000-4000-8000-000000000001`, "Maya Chen"). Every visitor reads and writes that row.
- `POST /api/scans` stores scores from `lib/scan-engine.ts` (random jitter around previous scores). The camera preview uses `getUserMedia`. The image is not analyzed and is not stored.
- `POST /api/chat` uses `lib/chat-engine.ts`. If `XAI_API_KEY` is set it calls xAI and otherwise stays on the rules. Replies are not retrieved from a knowledge base.
- `GET /api/health` checks Postgres and counts `skin_scans`.

## Decisions

These are the calls Phase 1 is expected to follow. Correct them before saying "continue" if one is wrong.

1. **The live Zerops app stays the web app.** The Next.js project remains at the repository root so `zerops.yaml` (`npm ci`, `next build`, `node migrate.js`) keeps working. New code is added beside it: `services/ml`, `packages/shared`, `data`, `docs`. A move to `apps/web` is deferred until a deploy cutover is worth the risk. Spec shape `/apps/web` is recorded as a later option in [architecture.md](architecture.md).

2. **One Postgres database. Prisma owns the schema.** The existing Zerops `db` service remains the database, including rows already stored. Prisma talks to it through `DATABASE_URL` built from the current `DB_*` variables. FastAPI uses SQLAlchemy only as a client of tables Prisma migrates. FastAPI does not ship a second migration history. `migrate.js` stays the Zerops entrypoint and will call Prisma migrate (or apply the checked-in SQL) so `zsc execOnce` still runs one command.

3. **Supabase is an adapter, not a requirement.** The spec names Supabase for Postgres, Auth, and Storage. This repo already has Postgres and a live deploy, and it has no Supabase project. Splitting data across two databases would fork the demo scans from the new product. Auth and storage sit behind interfaces. Guest sessions are first-party. Object storage can be Supabase Storage, any S3-compatible bucket, or "off". See risks if Zerops Postgres cannot enable `pgvector`.

4. **Guest mode is per browser, not one shared demo user.** Core features work with no account. Phase 1 issues an httpOnly cookie and a distinct `users` row. The Maya Chen seed remains available behind `DEMO_MODE=true` for the old dashboard story. It stops being the user for every visitor. This changes live behavior on purpose: visitors will no longer see each other's scans and chat.

5. **Face photos are not stored unless a persistent private bucket is configured and the user opts in.** Default is analyze-and-discard. The browser keeps the preview long enough to draw the returned zone overlay, then can drop it. Numbers and zone boxes can be saved. Pixels are not, until storage that survives a container restart exists. Zerops container disk is not that store.

6. **Public API is the Next.js app under `/api/v1`.** The browser never calls FastAPI. FastAPI listens on an internal port and requires `ML_SERVICE_TOKEN`. Existing routes (`/api/scans`, `/api/chat`, `/api/prefs`, `/api/plan`, `/api/dashboard`, `/api/health`) stay until the screen that uses them has moved. They are legacy. New work uses `/api/v1`.

7. **Scan analysis is asynchronous.** `POST /api/v1/scans` returns `202` and a scan id. The client polls `GET /api/v1/scans/{id}`. The job row lives in Postgres. No Redis. One process is enough on the current single-container deploy. Heavy work runs in FastAPI.

8. **The current scan engine stays only as a labeled fallback.** `analysis_kind = heuristic_v0`. The UI must say it is a placeholder estimate. It must not be shown as a measurement. Phase 2 adds `baseline_cv_v1`: MediaPipe face gate plus classical image features. That is still not a clinical model. Confidence is capped. Bad images return `rejected_quality` and no scores.

9. **Rules and routines are data, not a model.** Ingredient conflicts, pregnancy cautions, and routine templates live in versioned YAML under `data/`, validated by JSON Schema in `packages/shared`. The engine runs in TypeScript inside the Next.js server. The ML service does vision, OCR, and embeddings.

10. **LLM access stays behind a provider interface in the Next.js server**, where `XAI_API_KEY` already is. Providers: `rules` (default, free), `ollama` (free, local), `xai` (optional, paid). Missing key means the rules engine, not an error page. RAG arrives in Phase 5. Until citations exist, replies say they are not grounded in the knowledge base.

11. **Prices are user-supplied or official-API only.** The default provider stores links and prices a user pastes. The server does not scrape retailer HTML. Official APIs can be added later behind the same interface.

12. **License stays MIT.** `package.json` already says MIT. MIT is permissive, short, and matches the license this repo already ships. Apache-2.0 is the alternative if an explicit patent grant becomes important. No contributor license agreement in the MVP.

13. **Age is a range, not a birthdate.** Under 18 can use guest mode. Email or OAuth accounts wait until an adult account flow exists. No face image is kept for any age by default.

14. **English first.** Copy lives in message catalogs so Hindi and Tamil can be added without rewriting components. No translations in Phase 0.

15. **Medical boundary.** Every analysis, routine, and chat response carries: "Informational only, not a medical diagnosis." The app does not name a disease, dose a drug, or override a clinician. Procedure recovery mode tells the user their dermatologist's aftercare wins. Severe or non-routine findings show escalation copy. The baseline vision code must not label lesions as cancer or as benign.

## What Phase 1 is allowed to build

Only after you say "continue":

- Workspace layout (`services/ml`, `packages/shared`, `data`, `docs`) without moving the Next.js root.
- `docker-compose.yml` for local Postgres with pgvector, the web app, and the ML service.
- GitHub Actions: typecheck, lint, unit test skeleton. Zerops remains the deploy path already described by `zerops.yaml`.
- `.env.example` covering existing `DB_*` plus the new variables in [architecture.md](architecture.md).
- Additive SQL, applied from `migrate.js`, for the new tables and columns in [data-model.md](data-model.md). No drops of live columns.
- Guest cookie sessions and the `DEMO_MODE` split.
- Storage interface with the discard-by-default implementation.
- Health check extended to report ML service reachability, without failing the Zerops readiness path (`GET /` must stay up).

Phase 1 does not add the camera quality gate, OCR, recommendations, RAG, or recovery mode.

## How to check this phase

There is no new runtime. Review the docs. From the repo root:

```powershell
Get-ChildItem docs
```

The app still runs the old way, on Zerops or locally once `DB_*` is set:

```powershell
npm run dev
```

`npm run dev` needs the existing database env. This phase does not change that.

## Known limits of this phase

- No code from the feature list is implemented here.
- pgvector on Zerops Postgres is unverified. The fallback is documented.
- Dataset licenses for ACNE04, Fitzpatrick17k, SD-198, and DermNet are not cleared. They are not approved as training data.
- No accuracy, precision, recall, or F1 number is claimed, because none has been measured.
