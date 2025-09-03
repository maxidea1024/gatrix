-- Database cleanup script
-- This file removes test/sample data from the database
-- Execute with: npm run sql -- --file ./data/cleanup.sql --verbose

-- Clean up test users (keep admin users)
DELETE FROM g_users 
WHERE email LIKE '%@example.com' 
   OR email LIKE '%test%' 
   OR name LIKE 'Test %'
   OR name LIKE '%Test%';

-- Clean up test game worlds
DELETE FROM g_game_worlds 
WHERE worldId LIKE 'test_%' 
   OR worldId LIKE 'dev_%'
   OR name LIKE 'Test %'
   OR name LIKE '%Test%';

-- Clean up test tags
DELETE FROM g_tags 
WHERE name IN ('Development', 'Testing', 'Production', 'Maintenance')
   OR description LIKE '%test%'
   OR description LIKE '%development%';

-- Clean up test message templates
DELETE FROM g_message_templates 
WHERE name LIKE 'test_%'
   OR name IN ('welcome_email', 'password_reset', 'maintenance_notice');

-- Clean up test account whitelist entries
DELETE FROM g_account_whitelist 
WHERE accountId LIKE 'test_%'
   OR accountId LIKE '%test%'
   OR purpose LIKE '%test%'
   OR purpose LIKE '%development%';

-- Clean up test IP whitelist entries
DELETE FROM g_ip_whitelist 
WHERE description LIKE '%test%'
   OR description LIKE '%development%'
   OR ipAddress = '127.0.0.1';

-- Clean up test job types
DELETE FROM g_job_types 
WHERE name LIKE 'test_%'
   OR name IN ('test_job', 'email_job');

-- Clean up test jobs
DELETE FROM g_jobs 
WHERE jobType IN (
    SELECT name FROM g_job_types 
    WHERE name LIKE 'test_%'
);

-- Clean up test job executions
DELETE FROM g_job_executions 
WHERE jobId NOT IN (SELECT id FROM g_jobs);

-- Clean up orphaned tag assignments
DELETE FROM g_tag_assignments 
WHERE tagId NOT IN (SELECT id FROM g_tags);

-- Clean up audit logs older than 30 days (optional)
-- DELETE FROM g_audit_logs 
-- WHERE createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Reset auto increment values (optional)
-- ALTER TABLE g_users AUTO_INCREMENT = 1;
-- ALTER TABLE g_game_worlds AUTO_INCREMENT = 1;
-- ALTER TABLE g_tags AUTO_INCREMENT = 1;
-- ALTER TABLE g_message_templates AUTO_INCREMENT = 1;
-- ALTER TABLE g_account_whitelist AUTO_INCREMENT = 1;
-- ALTER TABLE g_ip_whitelist AUTO_INCREMENT = 1;
-- ALTER TABLE g_job_types AUTO_INCREMENT = 1;
-- ALTER TABLE g_jobs AUTO_INCREMENT = 1;
-- ALTER TABLE g_job_executions AUTO_INCREMENT = 1;
