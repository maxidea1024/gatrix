-- Add metrics_group_limit column to g_argus_projects
ALTER TABLE g_argus_projects
  ADD COLUMN metrics_group_limit INT DEFAULT 10 AFTER retention_days;
