# RiRu Phase 5

Chat answers from notes in `data/knowledge` and from the ingredient rule pack. A low-confidence question says it is not sure. The reply cites the note or rule ids it used.

Every chat payload still includes: "Informational only, not a medical diagnosis."

This is not a diagnosis, not a dose, and not a prescription. The notes were written for this app. They were not copied from a textbook or a product label.

## What works

- `data/knowledge/v1/pack.yaml` holds the notes. Each note has `id`, `title`, `source`, `topic`, `last_reviewed`, and a body.
- `npm run ingest:knowledge` embeds those notes and upserts `knowledge_chunks`. `chunk_key` is the note id. `db/phase5.sql` adds `chunk_key`, `topic`, and `last_reviewed`. `migrate.js` runs it after phase 3.
- `EMBEDDINGS_PROVIDER=local` runs `scripts/embed_local.py` (sentence-transformers, 384 dimensions). `EMBEDDINGS_PROVIDER=mock` is a deterministic hash of the same size, used by tests and by Docker Compose. Ingest and chat have to use the same provider.
- If the local model cannot run, retrieval still ranks notes by word overlap. If nothing clears the threshold and no rule fires, the reply is "I'm not sure" and names a dermatologist or pharmacist.
- Ingredient conflicts come from `evaluateVerdict` in `packages/shared`. A question that names retinol and glycolic acid cites `retinol_plus_aha`. The model is not asked to remember that rule.
- `LlmProvider` has Anthropic (`LLM_API_KEY`, `LLM_MODEL`), Ollama (`OLLAMA_BASE_URL`), and a mock. `DEMO_MODE=true` forces the mock. Anthropic with an empty key returns HTTP 503 "Chat is not configured." The process does not throw on startup.
- `POST /api/chat` keeps the session, stores citations, and streams when `stream` is true or the client accepts `text/event-stream`. Events are `token`, `citation`, `followups`, and `done`.
- The chat page shows the citation ids, follow-up questions, and a profile toggle that defaults to off. The toggle sends the latest scan summary and allergy, fragrance, and pregnancy flags. The SQL does not select `clinician_note`.
- A changing mole or a skin-cancer worry, and a request to prescribe or give a dose, are fixed refusals. User text is placed after `UNTRUSTED USER MESSAGE` and is not executed.
- The message limit is 2000 characters. The existing chat rate limit remains 30 an hour outside demo mode. Face photos are not sent to the model.
- `POST /api/plan` still uses the older template in `lib/chat-engine.ts`.

## How to run

From the repo root, after `npm run migrate`:

```powershell
$env:DEMO_MODE = "true"
$env:EMBEDDINGS_PROVIDER = "mock"
npm run ingest:knowledge
npm run dev
```

Open `/chat`. Leave the profile toggle off, ask how much sunscreen to apply, and confirm the reply names `sunscreen-amount`.

Anthropic, when you want it:

```powershell
$env:DEMO_MODE = "false"
$env:LLM_PROVIDER = "anthropic"
$env:LLM_API_KEY = "<set locally in .env.local, never commit it>"
$env:LLM_MODEL = "<the model id>"
```

`DEMO_MODE=true` keeps the mock even if those variables are set. A missing key with `DEMO_MODE` off and `LLM_PROVIDER=anthropic` answers that chat is not configured.

Local embeddings:

```powershell
pip install sentence-transformers
$env:EMBEDDINGS_PROVIDER = "local"
$env:EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
npm run ingest:knowledge
```

## Checks

Run on 2026-10-13 against the local Postgres 16 cluster (user `riru`, database `riru`, port 5432):

- `npm run migrate` finished. Log line: `Extension vector is not available`. Phase 5 columns were applied.
- `EMBEDDINGS_PROVIDER=mock npm run ingest:knowledge` stored 8 chunks.
- `npm test` with `RIRU_INTEGRATION=1`: 40 passed, 1 skipped, 0 failed. The skip is the optional Anthropic call (`LLM_API_KEY` and `LLM_MODEL` were not set). `tests/chat-db.integration.test.ts` ingested with the mock embedder and `POST /api/chat` returned citation `sunscreen-amount` with a 384-length `embedding_fallback`.
- `npm run typecheck` (`tsc --noEmit`) exited 0.
- `npm run prisma:validate` reported the schema valid.
- `npm run build` compiled and finished with exit code 0.
- Dev server with `DEMO_MODE=true` and `EMBEDDINGS_PROVIDER=mock` on `http://localhost:3000/chat`: a sunscreen question showed `sunscreen-amount`, a changing-mole question showed `safety_dermatologist`, and the profile checkbox started unchecked and toggled. The header reads RiRu. A hydration warning still points at `components/AppShell.tsx` line 40.

`tests/chat-rag.test.ts` covers retrieval, the retinol rule citation, the mole and dose refusals, an instruction that is not in the notes, and the profile SQL. The Anthropic test skips unless `LLM_API_KEY` and `LLM_MODEL` are set.

`tests/chat-db.integration.test.ts` skips unless `RIRU_INTEGRATION=1`. It expects the dev server to use the same embedding provider as ingest (`EMBEDDINGS_PROVIDER=mock` for that check).

## What this phase does not do

- pgvector is used only when `CREATE EXTENSION vector` succeeds. This Windows Postgres 16 build does not ship it, so vectors sit in `embedding_fallback` and ranking runs in the app. The HNSW index in `migrate.js` is unchanged and still skipped when the extension is missing.
- Sentence-transformers was not installed here, so the local provider was not executed. The mock embedder is what the tests use.
- The live Anthropic call was not run.
- No face image is part of chat. Scan context is the saved summary text, and only after the toggle is on.
