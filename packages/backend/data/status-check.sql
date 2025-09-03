-- Database status check script
-- This file provides an overview of the current database state
-- Execute with: npm run sql -- --file ./data/status-check.sql --verbose

-- Show database information
SELECT 
    'Database Info' as category,
    DATABASE() as database_name,
    VERSION() as mysql_version,
    NOW() as current_time;

-- Count records in all main tables
SELECT 'Table Counts' as category, 'g_users' as table_name, COUNT(*) as record_count FROM g_users
UNION ALL
SELECT 'Table Counts', 'g_game_worlds', COUNT(*) FROM g_game_worlds
UNION ALL
SELECT 'Table Counts', 'g_tags', COUNT(*) FROM g_tags
UNION ALL
SELECT 'Table Counts', 'g_message_templates', COUNT(*) FROM g_message_templates
UNION ALL
SELECT 'Table Counts', 'g_account_whitelist', COUNT(*) FROM g_account_whitelist
UNION ALL
SELECT 'Table Counts', 'g_ip_whitelist', COUNT(*) FROM g_ip_whitelist
UNION ALL
SELECT 'Table Counts', 'g_job_types', COUNT(*) FROM g_job_types
UNION ALL
SELECT 'Table Counts', 'g_jobs', COUNT(*) FROM g_jobs
UNION ALL
SELECT 'Table Counts', 'g_job_executions', COUNT(*) FROM g_job_executions
UNION ALL
SELECT 'Table Counts', 'g_tag_assignments', COUNT(*) FROM g_tag_assignments
UNION ALL
SELECT 'Table Counts', 'g_audit_logs', COUNT(*) FROM g_audit_logs
UNION ALL
SELECT 'Table Counts', 'g_vars', COUNT(*) FROM g_vars;

-- Show user statistics
SELECT 
    'User Statistics' as category,
    role,
    status,
    COUNT(*) as count
FROM g_users 
GROUP BY role, status
ORDER BY role, status;

-- Show game world statistics
SELECT 
    'Game World Statistics' as category,
    isEnabled,
    COUNT(*) as count
FROM g_game_worlds 
GROUP BY isEnabled;

-- Show recent activity (last 24 hours)
SELECT 
    'Recent Activity' as category,
    'Users created' as activity_type,
    COUNT(*) as count
FROM g_users 
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
UNION ALL
SELECT 
    'Recent Activity',
    'Jobs executed',
    COUNT(*)
FROM g_job_executions 
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
UNION ALL
SELECT 
    'Recent Activity',
    'Audit log entries',
    COUNT(*)
FROM g_audit_logs 
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- Show table sizes (approximate)
SELECT 
    'Table Sizes' as category,
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
FROM information_schema.TABLES 
WHERE table_schema = DATABASE()
    AND table_name LIKE 'g_%'
ORDER BY (data_length + index_length) DESC;

-- Show enabled/disabled items
SELECT 'Enabled Items' as category, 'Game Worlds' as item_type, COUNT(*) as enabled_count
FROM g_game_worlds WHERE isEnabled = 1
UNION ALL
SELECT 'Enabled Items', 'Message Templates', COUNT(*)
FROM g_message_templates WHERE isEnabled = 1
UNION ALL
SELECT 'Enabled Items', 'Account Whitelist', COUNT(*)
FROM g_account_whitelist WHERE isEnabled = 1
UNION ALL
SELECT 'Enabled Items', 'IP Whitelist', COUNT(*)
FROM g_ip_whitelist WHERE isEnabled = 1
UNION ALL
SELECT 'Enabled Items', 'Job Types', COUNT(*)
FROM g_job_types WHERE isEnabled = 1;
