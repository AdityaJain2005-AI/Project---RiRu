-- Additive RiRu schema. Safe to re-run. Applied by migrate.js.
-- Does not create extensions, knowledge-chunk vector indexes, or guest purges.
-- Those depend on the server and run in migrate.js after this script.

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
CREATE INDEX IF NOT EXISTS users_guest_updated_idx
  ON users (updated_at)
  WHERE auth_provider = 'guest' AND deleted_at IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
  CHECK (auth_provider IN ('guest', 'email', 'oauth', 'demo'));

UPDATE users
SET auth_provider = 'demo'
WHERE id = '00000000-0000-4000-8000-000000000001'
  AND auth_provider IS DISTINCT FROM 'demo';

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

INSERT INTO profiles (user_id)
VALUES ('00000000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

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

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  status          text NOT NULL,
  idempotency_key text,
  scan_id         uuid REFERENCES skin_scans(id) ON DELETE CASCADE,
  ingredient_scan_id uuid REFERENCES ingredient_scans(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS routines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_id         uuid REFERENCES skin_scans(id) ON DELETE SET NULL,
  recovery_id     uuid REFERENCES procedure_recoveries(id) ON DELETE SET NULL,
  ruleset_version text NOT NULL,
  summary         text NOT NULL,
  lifestyle       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routines_user_created_idx
  ON routines (user_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS routine_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id    uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  period        text NOT NULL,
  position      integer NOT NULL,
  kind          text NOT NULL,
  title         text NOT NULL,
  instructions  text NOT NULL,
  why           text NOT NULL,
  product_id    uuid REFERENCES products(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS guest_signup_windows (
  ip_hash        text NOT NULL,
  window_start   timestamptz NOT NULL,
  created_count  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source               text NOT NULL,
  heading              text NOT NULL DEFAULT '',
  content              text NOT NULL,
  content_hash         text NOT NULL,
  embedding_fallback   double precision[] NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, content_hash)
);
