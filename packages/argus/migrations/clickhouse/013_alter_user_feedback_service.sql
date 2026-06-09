-- Add service column to user_feedback table for multi-service feedback filtering
ALTER TABLE argus.user_feedback ADD COLUMN IF NOT EXISTS service LowCardinality(String) DEFAULT '';
