-- Add metrics_group_limit column to g_argus_projects
DROP PROCEDURE IF EXISTS _argus_012_migrate;

DELIMITER //
CREATE PROCEDURE _argus_012_migrate()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_projects' AND COLUMN_NAME = 'metrics_group_limit') THEN
    ALTER TABLE g_argus_projects ADD COLUMN metrics_group_limit INT DEFAULT 10 AFTER retention_days;
  END IF;
END //
DELIMITER ;

CALL _argus_012_migrate();
DROP PROCEDURE IF EXISTS _argus_012_migrate;
