-- Add workflow columns to user_feedback table
ALTER TABLE argus.user_feedback
  ADD COLUMN IF NOT EXISTS `status`          LowCardinality(String) DEFAULT 'unresolved' AFTER `tags`,
  ADD COLUMN IF NOT EXISTS `assigned_to`     String DEFAULT '' AFTER `status`,
  ADD COLUMN IF NOT EXISTS `is_spam`         UInt8 DEFAULT 0 AFTER `assigned_to`,
  ADD COLUMN IF NOT EXISTS `attachments`     Array(String) DEFAULT [] AFTER `is_spam`,
  ADD COLUMN IF NOT EXISTS `resolved_at`     Nullable(DateTime64(3)) DEFAULT NULL AFTER `attachments`;
