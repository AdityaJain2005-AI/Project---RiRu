-- Phase 6 privacy flag. Safe to re-run.
-- Images are deleted after analysis unless the caller turns this off.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delete_image_after_analysis boolean NOT NULL DEFAULT true;

ALTER TABLE consent_log DROP CONSTRAINT IF EXISTS consent_log_purpose_check;
ALTER TABLE consent_log ADD CONSTRAINT consent_log_purpose_check CHECK (purpose IN (
  'camera_analysis', 'store_image', 'training_opt_in', 'chat_context', 'delete_image_after'
));
