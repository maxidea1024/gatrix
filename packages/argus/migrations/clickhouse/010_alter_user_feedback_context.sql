-- Add device context, user identity, read status, and AI classification columns to user_feedback
-- Each ALTER TABLE is a separate statement to avoid compatibility issues

ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS browser LowCardinality(String) DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS browser_version String DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS os LowCardinality(String) DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS os_version String DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS device String DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS user_id String DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS locale LowCardinality(String) DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS is_read UInt8 DEFAULT 0;
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS category LowCardinality(String) DEFAULT '';
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS sentiment LowCardinality(String) DEFAULT '';
