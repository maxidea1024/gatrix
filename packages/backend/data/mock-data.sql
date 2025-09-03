-- Mock data for comprehensive testing
-- This file creates a more realistic dataset for development and testing
-- Execute with: npm run sql -- --file ./data/mock-data.sql --verbose

-- Create more realistic users
INSERT INTO g_users (name, email, role, status, emailVerified, passwordHash) VALUES
('John Smith', 'john.smith@company.com', 'admin', 'active', 1, '$2b$10$example.hash.john'),
('Sarah Johnson', 'sarah.johnson@company.com', 'manager', 'active', 1, '$2b$10$example.hash.sarah'),
('Mike Davis', 'mike.davis@company.com', 'user', 'active', 1, '$2b$10$example.hash.mike'),
('Emily Brown', 'emily.brown@company.com', 'user', 'active', 1, '$2b$10$example.hash.emily'),
('David Wilson', 'david.wilson@company.com', 'user', 'pending', 0, '$2b$10$example.hash.david'),
('Lisa Garcia', 'lisa.garcia@company.com', 'user', 'active', 1, '$2b$10$example.hash.lisa'),
('Tom Anderson', 'tom.anderson@company.com', 'manager', 'active', 1, '$2b$10$example.hash.tom'),
('Anna Martinez', 'anna.martinez@company.com', 'user', 'inactive', 1, '$2b$10$example.hash.anna')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  status = VALUES(status);

-- Create game worlds with more detail
INSERT INTO g_game_worlds (worldId, name, description, isEnabled, displayOrder, createdBy) VALUES
('prod_world_01', 'Production World Alpha', 'Main production world for live players', 1, 1, 1),
('prod_world_02', 'Production World Beta', 'Secondary production world for overflow', 1, 2, 1),
('staging_world_01', 'Staging World', 'Staging environment for testing new features', 1, 3, 1),
('dev_world_01', 'Development World', 'Development environment for feature development', 1, 4, 1),
('test_world_01', 'QA Test World', 'Quality assurance testing environment', 0, 5, 1),
('backup_world_01', 'Backup World', 'Backup world for emergency situations', 0, 6, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  isEnabled = VALUES(isEnabled);

-- Create comprehensive tags
INSERT INTO g_tags (name, color, description, createdBy) VALUES
('Critical', '#D32F2F', 'Critical priority items requiring immediate attention', 1),
('High Priority', '#F57C00', 'High priority items', 1),
('Medium Priority', '#1976D2', 'Medium priority items', 1),
('Low Priority', '#388E3C', 'Low priority items', 1),
('Bug', '#E91E63', 'Bug reports and fixes', 1),
('Feature', '#9C27B0', 'New features and enhancements', 1),
('Security', '#FF5722', 'Security related items', 1),
('Performance', '#607D8B', 'Performance optimization items', 1),
('Documentation', '#795548', 'Documentation related items', 1),
('Infrastructure', '#455A64', 'Infrastructure and deployment items', 1)
ON DUPLICATE KEY UPDATE
  color = VALUES(color),
  description = VALUES(description);

-- Create message templates for various scenarios
INSERT INTO g_message_templates (name, subject, content, isEnabled, createdBy) VALUES
('user_registration', 'Welcome to {{platform_name}}!', 
 'Dear {{user_name}},\n\nWelcome to {{platform_name}}! Your account has been successfully created.\n\nYour login details:\nEmail: {{user_email}}\n\nPlease verify your email by clicking the link below:\n{{verification_link}}\n\nBest regards,\nThe {{platform_name}} Team', 
 1, 1),
('password_reset_request', 'Password Reset Request for {{platform_name}}', 
 'Dear {{user_name}},\n\nWe received a request to reset your password for your {{platform_name}} account.\n\nClick the link below to reset your password:\n{{reset_link}}\n\nThis link will expire in 24 hours.\n\nIf you did not request this reset, please ignore this email.\n\nBest regards,\nThe {{platform_name}} Team', 
 1, 1),
('maintenance_notification', 'Scheduled Maintenance - {{platform_name}}', 
 'Dear Users,\n\nWe will be performing scheduled maintenance on {{platform_name}}.\n\nMaintenance Window:\nStart: {{maintenance_start}}\nEnd: {{maintenance_end}}\nDuration: {{maintenance_duration}}\n\nDuring this time, the service will be unavailable.\n\nWe apologize for any inconvenience.\n\nBest regards,\nThe {{platform_name}} Team', 
 1, 1),
('account_locked', 'Account Security Alert - {{platform_name}}', 
 'Dear {{user_name}},\n\nYour account has been temporarily locked due to multiple failed login attempts.\n\nTo unlock your account, please:\n1. Wait 30 minutes for automatic unlock, or\n2. Reset your password using the link below:\n{{reset_link}}\n\nIf you believe this is an error, please contact support.\n\nBest regards,\nThe {{platform_name}} Team', 
 1, 1)
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  content = VALUES(content),
  isEnabled = VALUES(isEnabled);

-- Create account whitelist entries for different purposes
INSERT INTO g_account_whitelist (accountId, purpose, isEnabled, createdBy) VALUES
('dev_test_001', 'Primary development testing account', 1, 1),
('dev_test_002', 'Secondary development testing account', 1, 1),
('qa_automation_001', 'QA automation testing account', 1, 1),
('qa_manual_001', 'QA manual testing account', 1, 1),
('load_test_001', 'Load testing account', 1, 1),
('admin_emergency_001', 'Emergency admin access account', 1, 1),
('integration_test_001', 'Integration testing account', 1, 1),
('performance_test_001', 'Performance testing account', 0, 1)
ON DUPLICATE KEY UPDATE
  purpose = VALUES(purpose),
  isEnabled = VALUES(isEnabled);

-- Create IP whitelist entries for different environments
INSERT INTO g_ip_whitelist (ipAddress, description, isEnabled, createdBy) VALUES
('127.0.0.1', 'Localhost development', 1, 1),
('192.168.1.0/24', 'Office network range', 1, 1),
('10.0.0.0/16', 'Internal VPN range', 1, 1),
('172.16.0.0/12', 'Docker network range', 1, 1),
('203.0.113.0/24', 'External partner network', 1, 1),
('198.51.100.0/24', 'QA testing network', 1, 1),
('192.0.2.0/24', 'Staging environment network', 0, 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  isEnabled = VALUES(isEnabled);

-- Create job types for various automation tasks
INSERT INTO g_job_types (name, displayName, description, jobSchema, isEnabled, createdBy) VALUES
('send_email', 'Send Email', 'Send email notifications to users', 
 '{"to": {"type": "string", "required": true, "description": "Recipient email address"}, "subject": {"type": "string", "required": true, "description": "Email subject"}, "template": {"type": "string", "required": false, "description": "Template name"}, "variables": {"type": "object", "required": false, "description": "Template variables"}}', 
 1, 1),
('backup_database', 'Database Backup', 'Create database backup', 
 '{"database": {"type": "string", "required": true, "description": "Database name"}, "compression": {"type": "boolean", "required": false, "default": true, "description": "Enable compression"}, "retention_days": {"type": "number", "required": false, "default": 30, "description": "Backup retention in days"}}', 
 1, 1),
('cleanup_logs', 'Log Cleanup', 'Clean up old log files', 
 '{"log_type": {"type": "string", "required": true, "enum": ["application", "access", "error"], "description": "Type of logs to clean"}, "days_to_keep": {"type": "number", "required": false, "default": 7, "description": "Number of days to keep logs"}}', 
 1, 1),
('sync_users', 'User Synchronization', 'Synchronize users with external system', 
 '{"source": {"type": "string", "required": true, "description": "Source system identifier"}, "dry_run": {"type": "boolean", "required": false, "default": false, "description": "Perform dry run without making changes"}}', 
 1, 1)
ON DUPLICATE KEY UPDATE
  displayName = VALUES(displayName),
  description = VALUES(description),
  jobSchema = VALUES(jobSchema),
  isEnabled = VALUES(isEnabled);
