# RiRu data model

Phase 0 contract. The live database is whatever `migrate.js` last applied on Zerops Postgres. This document is the target. Phase 1 applies **additive** changes only. Do not drop `metrics`, `concerns`, `ingredients`, `greetings`, or the Maya Chen seed row.

Prisma target: [schema.prisma](schema.prisma). Phase 1 copies it to `prisma/schema.prisma` and generates a migration that matches the SQL below. Until that lands, `migrate.js` is the only writer of schema.

## What is live today

From `migrate.js`:

| Table | Purpose now | Fate |
|---|---|---|
| `greetings` | Zerops sample row | Leave it. Harmless. |
| `users` | One demo user | Add auth and deletion columns. New guests get their own rows. |
| `skin_scans` | JSON metrics, concerns, ingredients | Keep. Add status, quality, model label. Add `scan_findings`. |
| `chat_messages` | One thread per demo user, roles `user` and `ai` | Add nullable `session_id` and citations. Widen the role check. |
| `user_prefs` | `routine_phase`, favorite ingredients, settings JSON | Stop writing after Phase 1. Canonical copy is `profiles`. Table stays so old code does not crash during the switch. |
| `notifications` | Dashboard notices | Stays. Not part of the public v1 contract. |

`users.id` `00000000-0000-4000-8000-000000000001` stays. `DEMO_MODE` is the only path that still loads it in the UI.

## Ownership

Prisma is the schema owner. The SQL in this file is what the first Prisma migration must produce, plus the `ALTER`s against tables that already exist. FastAPI does not create tables.

`pgcrypto` is already enabled (`gen_random_uuid()`). Phase 1 tries:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

If that statement fails, the migration catches it, records `vector_available = false` in a `schema_flags` row, and creates `knowledge_chunks.embedding_fallback double precision[]` instead of `vector(384)`. Application code checks the flag. See [risks.md](risks.md).

## Table list

| Table | Purpose |
|---|---|
| `users` | Guest or account identity |
| `profiles` | Goals, allergies, budget, pregnancy, fragrance, consent cache |
| `consent_log` | Append-only purpose grants and withdrawals |
| `deletion_receipts` | Proof a delete ran, with no personal fields |
| `skin_scans` | One analysis attempt |
| `scan_findings` | One concern on one scan |
| `analysis_jobs` | Queue rows for scan, OCR, and ingest |
| `routines` | A generated AM/PM plan |
| `routine_steps` | Ordered steps inside a routine |
| `check_ins` | Optional daily adherence. Missing a day is not a failure row. |
| `ingredients` | INCI catalog |
| `ingredient_rules` | Versioned conflicts and cautions loaded from YAML |
| `products` | Seed catalog |
| `product_ingredients` | Product to INCI, with optional rank |
| `price_listings` | Manual or official prices |
| `ingredient_scans` | OCR attempt and parsed tokens |
| `chat_sessions` | One conversation |
| `chat_messages` | Turns. Legacy rows have null session. |
| `knowledge_chunks` | RAG source chunks and embeddings |
| `feedback_reports` | "Report incorrect info" |
| `procedure_recoveries` | Active or past procedure mode |
| `schema_flags` | One row: whether pgvector loaded |
| `user_prefs` | Legacy. Not extended. |
| `notifications` | Legacy. Not extended. |
| `greetings` | Legacy. Not extended. |

## Additive SQL (Phase 1 applies this)

Types and checks are part of the contract.

```sql
-- Safe to re-run. Matches the migrate.js style.

CREATE TABLE IF NOT EXISTS schema_flags (
  id                integer PRIMARY KEY CHECK (id = 1),
  vector_available  boolean NOT NULL,
  checked_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'guest';
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_guest_token_unique
  ON users (guest_token_hash) WHERE guest_token_hash IS NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
  CHECK (auth_provider IN ('guest', 'email', 'oauth'));

ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'succeeded';
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS model_version text;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS analysis_kind text NOT NULL DEFAULT 'heuristic_v0';
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS store_image boolean NOT NULL DEFAULT false;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS image_ref text;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS image_expires_at timestamptz;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS quality jsonb;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS skin_type text;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS skin_type_confidence real;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS zones jsonb;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS disclaimer_ack boolean NOT NULL DEFAULT false;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE skin_scans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE skin_scans DROP CONSTRAINT IF EXISTS skin_scans_status_check;
ALTER TABLE skin_scans ADD CONSTRAINT skin_scans_status_check
  CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'rejected_quality'));

ALTER TABLE skin_scans DROP CONSTRAINT IF EXISTS skin_scans_analysis_kind_check;
ALTER TABLE skin_scans ADD CONSTRAINT skin_scans_analysis_kind_check
  CHECK (analysis_kind IN ('heuristic_v0', 'baseline_cv_v1', 'pending'));

ALTER TABLE skin_scans DROP CONSTRAINT IF EXISTS skin_scans_skin_type_check;
ALTER TABLE skin_scans ADD CONSTRAINT skin_scans_skin_type_check
  CHECK (
    skin_type IS NULL OR
    skin_type IN ('oily', 'dry', 'combination', 'normal', 'sensitive', 'unknown')
  );

CREATE UNIQUE INDEX IF NOT EXISTS skin_scans_user_idempotency_idx
  ON skin_scans (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS scan_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       uuid NOT NULL REFERENCES skin_scans(id) ON DELETE CASCADE,
  concern       text NOT NULL,
  severity      text NOT NULL,
  confidence    real NOT NULL,
  region        jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation   text NOT NULL,
  escalate      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_findings_concern_check CHECK (concern IN (
    'acne', 'blackheads_pores', 'pigmentation', 'redness',
    'dark_circles', 'texture', 'fine_lines', 'dehydration'
  )),
  CONSTRAINT scan_findings_severity_check CHECK (
    severity IN ('none', 'mild', 'moderate', 'severe')
  ),
  CONSTRAINT scan_findings_confidence_check CHECK (
    confidence >= 0 AND confidence <= 1
  )
);

CREATE INDEX IF NOT EXISTS scan_findings_scan_idx ON scan_findings (scan_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_range            text NOT NULL DEFAULT 'undisclosed',
  skin_goals           jsonb NOT NULL DEFAULT '[]'::jsonb,
  allergies            jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget               text NOT NULL DEFAULT 'any',
  currency             text NOT NULL DEFAULT 'USD',
  locale               text NOT NULL DEFAULT 'en',
  pregnant_or_feeding  boolean NOT NULL DEFAULT false,
  fragrance_sensitive  boolean NOT NULL DEFAULT false,
  self_described_sensitive boolean NOT NULL DEFAULT false,
  allow_scan_in_chat   boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_age_range_check CHECK (age_range IN (
    'under_18', '18_24', '25_34', '35_44', '45_plus', 'undisclosed'
  )),
  CONSTRAINT profiles_budget_check CHECK (budget IN ('low', 'mid', 'high', 'any')),
  CONSTRAINT profiles_locale_check CHECK (locale IN ('en', 'hi', 'ta'))
);

CREATE TABLE IF NOT EXISTS consent_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text NOT NULL,
  granted     boolean NOT NULL,
  policy_version text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_log_purpose_check CHECK (purpose IN (
    'camera_analysis', 'store_image', 'training_opt_in', 'chat_context'
  ))
);

CREATE INDEX IF NOT EXISTS consent_log_user_idx ON consent_log (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS deletion_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  text NOT NULL UNIQUE,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  status          text NOT NULL,
  idempotency_key text,
  scan_id         uuid REFERENCES skin_scans(id) ON DELETE CASCADE,
  ingredient_scan_id uuid,
  error_code      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analysis_jobs_kind_check CHECK (
    kind IN ('face_scan', 'ingredient_ocr', 'knowledge_ingest')
  ),
  CONSTRAINT analysis_jobs_status_check CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_jobs_idempotency_idx
  ON analysis_jobs (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx
  ON analysis_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS routines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_id         uuid REFERENCES skin_scans(id) ON DELETE SET NULL,
  recovery_id     uuid,
  ruleset_version text NOT NULL,
  summary         text NOT NULL,
  lifestyle       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routines_user_created_idx
  ON routines (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS routine_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id    uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  period        text NOT NULL,
  position      integer NOT NULL,
  kind          text NOT NULL,
  title         text NOT NULL,
  instructions  text NOT NULL,
  why           text NOT NULL,
  product_id    uuid,
  caution       text,
  CONSTRAINT routine_steps_period_check CHECK (period IN ('am', 'pm', 'weekly')),
  CONSTRAINT routine_steps_kind_check CHECK (kind IN (
    'cleanser', 'treatment', 'moisturizer', 'spf', 'extra'
  )),
  UNIQUE (routine_id, period, position)
);

CREATE TABLE IF NOT EXISTS check_ins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id          uuid REFERENCES routines(id) ON DELETE SET NULL,
  day                 date NOT NULL,
  completed_step_ids  uuid[] NOT NULL DEFAULT '{}',
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inci             text NOT NULL UNIQUE,
  functions        jsonb NOT NULL DEFAULT '[]'::jsonb,
  irritancy        smallint,
  comedogenicity   smallint,
  pregnancy_note   text NOT NULL DEFAULT '',
  avoid_if         jsonb NOT NULL DEFAULT '[]'::jsonb,
  typical_range    text,
  plain_description text NOT NULL DEFAULT '',
  source           text NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredients_irritancy_check CHECK (
    irritancy IS NULL OR (irritancy BETWEEN 0 AND 5)
  ),
  CONSTRAINT ingredients_comedogenicity_check CHECK (
    comedogenicity IS NULL OR (comedogenicity BETWEEN 0 AND 5)
  )
);

CREATE INDEX IF NOT EXISTS ingredients_inci_trgm_idx ON ingredients (inci);

CREATE TABLE IF NOT EXISTS ingredient_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key      text NOT NULL,
  version       text NOT NULL,
  kind          text NOT NULL,
  definition    jsonb NOT NULL,
  source        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version),
  CONSTRAINT ingredient_rules_kind_check CHECK (
    kind IN ('conflict', 'caution', 'avoid', 'nuance')
  )
);

CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  brand         text NOT NULL,
  step_kind     text NOT NULL,
  budget        text NOT NULL,
  fragrance_free boolean NOT NULL DEFAULT false,
  minimal_ingredient boolean NOT NULL DEFAULT false,
  description   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_step_kind_check CHECK (step_kind IN (
    'cleanser', 'treatment', 'moisturizer', 'spf', 'extra'
  )),
  CONSTRAINT products_budget_check CHECK (budget IN ('low', 'mid', 'high'))
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id  uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  position       integer NOT NULL,
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS price_listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider     text NOT NULL,
  price_cents  integer NOT NULL CHECK (price_cents >= 0),
  currency     text NOT NULL,
  url          text NOT NULL,
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_listings_provider_check CHECK (provider IN ('manual', 'official'))
);

CREATE INDEX IF NOT EXISTS price_listings_product_idx
  ON price_listings (product_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS ingredient_scans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL,
  ocr_text      text,
  parsed        jsonb,
  confirmed_text text,
  store_image   boolean NOT NULL DEFAULT false,
  image_ref     text,
  idempotency_key text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredient_scans_status_check CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed', 'rejected_quality')
  )
);

CREATE INDEX IF NOT EXISTS ingredient_scans_user_idx
  ON ingredient_scans (user_id, created_at DESC);

ALTER TABLE analysis_jobs
  DROP CONSTRAINT IF EXISTS analysis_jobs_ingredient_scan_id_fkey;
ALTER TABLE analysis_jobs
  ADD CONSTRAINT analysis_jobs_ingredient_scan_id_fkey
  FOREIGN KEY (ingredient_scan_id) REFERENCES ingredient_scans(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_idx
  ON chat_sessions (user_id, updated_at DESC);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS citations jsonb;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS retrieval_score real;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_role_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'ai', 'assistant', 'system'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_session_id_fkey'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chat_messages_session_idx
  ON chat_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
  heading       text NOT NULL DEFAULT '',
  content       text NOT NULL,
  content_hash  text NOT NULL,
  embedding     vector(384),
  embedding_fallback double precision[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, content_hash)
);
```

The `knowledge_chunks.embedding vector(384)` column is created only when `schema_flags.vector_available` is true. When it is false, Phase 1 omits that column and keeps `embedding_fallback`. The Prisma file shows the vector column because that is the intended production shape. Phase 1's migration splits on the flag and the Prisma model uses `Unsupported("vector(384)")` only after the extension has loaded. If the extension is missing, Prisma maps `embedding_fallback` and the vector field stays unused. This split is awkward and it is intentional: a migrate that crashes on Zerops is worse.

HNSW index, only if the extension loaded:

```sql
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
```

`ingredients_inci_trgm_idx` needs `pg_trgm`. If `CREATE EXTENSION pg_trgm` fails, skip that index. Fuzzy match still runs in the application process against the catalog, which is small.

```sql
CREATE TABLE IF NOT EXISTS feedback_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  topic        text NOT NULL,
  target_ref   text,
  message      text NOT NULL,
  page_url     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_reports_topic_check CHECK (topic IN (
    'ingredient', 'rule', 'scan', 'routine', 'product', 'other'
  ))
);

CREATE TABLE IF NOT EXISTS procedure_recoveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  procedure_type   text NOT NULL,
  procedure_on     date,
  active           boolean NOT NULL DEFAULT true,
  clinician_note   text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procedure_recoveries_type_check CHECK (procedure_type IN (
    'laser', 'peel', 'microneedling', 'other'
  ))
);

CREATE INDEX IF NOT EXISTS procedure_recoveries_user_idx
  ON procedure_recoveries (user_id, active);
```

`routines.recovery_id` references `procedure_recoveries`. The foreign key is added after both tables exist:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'routines_recovery_id_fkey'
  ) THEN
    ALTER TABLE routines
      ADD CONSTRAINT routines_recovery_id_fkey
      FOREIGN KEY (recovery_id) REFERENCES procedure_recoveries(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE routine_steps
  DROP CONSTRAINT IF EXISTS routine_steps_product_id_fkey;
ALTER TABLE routine_steps
  ADD CONSTRAINT routine_steps_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
```

## Seeds

Phase 1 seeds, in addition to the existing Maya Chen row:

- A `profiles` row for the demo user, copied from `user_prefs` when that row exists. Goals empty, budget `any`, `allow_scan_in_chat` false.
- No extra face scans. The existing seed scan stays `analysis_kind = heuristic_v0` via the column default. The UI must label it as a sample, not a measurement.
- Ingredient, rule, and product seeds wait for Phase 3 and Phase 4, loaded from `data/` so contributors do not edit SQL to fix an INCI name.

`pg_trgm` and a few starter INCI rows are not required for Phase 1's guest-session work.

## Indexes already present

Keep these. Prisma must use the same names so it does not try to recreate them:

- `skin_scans_user_created_idx` on `(user_id, created_at DESC)`
- `chat_messages_user_created_idx` on `(user_id, created_at ASC)`

## Privacy notes on the columns

- `guest_token_hash` stores a hash of the cookie, not the cookie.
- `email` is nullable and unique among live users.
- `ocr_text` and `chat_messages.content` are personal data. Export includes them. Delete cascades them. Logs do not.
- `image_ref` is a storage key, never a public URL. `store_image = false` implies both ref columns are null.
- `deletion_receipts` has no user id.
- Idle guests: a daily job deletes users where `auth_provider = 'guest'` and `updated_at` is older than `GUEST_RETENTION_DAYS` (default 30) and `deleted_at` is null. The job writes a deletion receipt and then deletes the row. Demo user is excluded.

## Rule file shape

Contributors edit YAML. JSON Schema lives in `packages/shared` in Phase 3. One rule looks like this:

```yaml
rule_key: retinol_plus_aha
version: v1
kind: conflict
source: "Standard cosmetic-chemistry caution. Not a clinical guideline."
when:
  all_present: ["retinol", "glycolic acid"]
unless_profile:
  recovery_active: true   # recovery mode already strips both
effect:
  verdict: caution
  message: "Retinoids and strong AHAs used together raise irritation for many people. Introduce one at a time."
```

`kind: nuance` is how vitamin C plus niacinamide is encoded. The message must say the old "never mix" claim is overstated at cosmetic pH, and that irritation is still possible on a damaged barrier. The engine returns the YAML message. It does not let the LLM rewrite a rule.

Pregnancy avoid rules set `effect.verdict: avoid` when `pregnant_or_feeding` is true. The message tells the user to follow their clinician. The app does not compute a dose.

## Product alternatives

Phase 4 similarity is overlap of INCI ids (Jaccard) inside the same `step_kind`, with hard filters: allergy miss, fragrance when the profile is sensitive, recovery-incompatible actives removed, budget tier of the candidate recorded so the UI can show two other tiers. Vectors over ingredient lists are unnecessary at catalog size. The spec asked for vector similarity plus rules. We do both only if the catalog grows past a few hundred products: embed the sorted INCI string with the same MiniLM model and blend with Jaccard. Until that size, Jaccard plus the filters is the implementation, and the API field `method` returns `jaccard_v1` so the choice is visible.
