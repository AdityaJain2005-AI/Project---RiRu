-- Allow a queued or rejected scan to exist before any score is known.
ALTER TABLE skin_scans ALTER COLUMN overall_score DROP NOT NULL;
