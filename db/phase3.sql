-- Phase 3. Idempotency for ingredient scans.
-- Partial unique indexes stay in SQL. Prisma has no matching @@unique on a nullable key.
-- The SQL ingredients and ingredient_rules tables stay empty. The app reads data/*.yaml.

CREATE UNIQUE INDEX IF NOT EXISTS ingredient_scans_user_idempotency_idx
  ON ingredient_scans (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
