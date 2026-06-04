-- Add dsn_key_id column to errors table for per-key usage tracking
ALTER TABLE argus.errors ADD COLUMN IF NOT EXISTS
  `dsn_key_id` UInt32 DEFAULT 0 AFTER `project_id`;

-- Add dsn_key_id column to transactions table for per-key usage tracking
ALTER TABLE argus.transactions ADD COLUMN IF NOT EXISTS
  `dsn_key_id` UInt32 DEFAULT 0 AFTER `project_id`;
