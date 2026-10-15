# Contributing

RiRu is an informational skincare guide. It is not a medical device and it does not diagnose skin disease.

## Setup

1. Copy `.env.example` to `.env.local`. Do not commit `.env.local` or any LLM API key.
2. PostgreSQL is required for the request path. Local development on this machine uses a Postgres 16 cluster. The `vector` extension is not installed, so embeddings stay in `embedding_fallback`.
3. `npm ci`
4. `npm run dev` and open `http://localhost:3000`.

`DEMO_MODE=true` with `LLM_PROVIDER=mock` and `EMBEDDINGS_PROVIDER=mock` is the path that runs without an API key. An empty key must leave chat as “not configured”, not crash.

## Checks before a pull request

```powershell
npm test
npm run typecheck
npm run prisma:validate
npm run build
```

After `npm run build`, delete `.next` before the next `npm run dev`. A dev server that reuses a production `.next` can answer API routes with an HTML 404.

Integration tests that touch Postgres run only when `RIRU_INTEGRATION=1`. CI does not start Postgres, so those tests stay skipped there.

Python checks, from `services/ml`:

```powershell
ruff check services/ml
pytest services/ml
```

## Boundaries

- Next.js is the only public API. `services/ml` is an internal worker.
- Do not add a trained skin model, a new `analysis_kind`, or filled Fitzpatrick metrics unless the measurements were actually run.
- Do not send the recovery clinician note to the LLM.
- Do not write secrets into docs, logs, or committed files.
