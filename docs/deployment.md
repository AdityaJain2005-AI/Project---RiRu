# Deployment

The app that has actually been deployed is the Zerops stage named in the README. The other options below are documented from the repo. They were not redeployed in Phase 9.

## Zerops

- HTTP port `3000`.
- Sibling Postgres uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_NAME`.
- Runtime is Node.js 22. `next.config.ts` sets `output: "standalone"`.
- Run migrations with `node migrate.js` before serving. Do not cache `.next/cache`.

## Docker Compose

`docker-compose.yml` starts the web app and Postgres for local containers. Set providers to `mock` when no LLM key is present. Change `SESSION_SECRET` and `ML_SERVICE_TOKEN` before any shared deploy. This machine does not have Docker installed, so compose was not started here.

## Vercel and Supabase

Not deployed from this checkout. The database path uses `pg` and `embedding_fallback double precision[]` because the local cluster has no `vector` extension. A Supabase project would need the same schema, including that fallback, before chat retrieval could run. Do not assume `pgvector` or HNSW.

Production responses include a content-security header. It allows `'unsafe-inline'` because Next.js hydration scripts are inline. That header is omitted in `next dev`.
