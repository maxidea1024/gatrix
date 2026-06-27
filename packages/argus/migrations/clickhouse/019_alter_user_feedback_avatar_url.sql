-- Add avatar_url column to user_feedback table for user avatar display
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS avatar_url String DEFAULT '' CODEC(ZSTD(3));
