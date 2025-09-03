-- Sample users data for testing
-- This file can be executed using: npm run sql -- --file ./data/sample-users.sql

-- Insert sample users
INSERT INTO g_users (name, email, role, status, emailVerified, passwordHash) VALUES
('Admin User', 'admin@example.com', 'admin', 'active', 1, '$2b$10$example.hash.for.admin.user'),
('Test User 1', 'user1@example.com', 'user', 'active', 1, '$2b$10$example.hash.for.user1'),
('Test User 2', 'user2@example.com', 'user', 'active', 1, '$2b$10$example.hash.for.user2'),
('Test User 3', 'user3@example.com', 'user', 'pending', 0, '$2b$10$example.hash.for.user3'),
('Manager User', 'manager@example.com', 'manager', 'active', 1, '$2b$10$example.hash.for.manager')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  status = VALUES(status),
  emailVerified = VALUES(emailVerified);

-- Insert sample game worlds
INSERT INTO g_game_worlds (worldId, name, description, isEnabled, displayOrder, createdBy) VALUES
('world001', 'Test World 1', 'First test world for development', 1, 1, 1),
('world002', 'Test World 2', 'Second test world for development', 1, 2, 1),
('world003', 'Test World 3', 'Third test world for development', 0, 3, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  isEnabled = VALUES(isEnabled),
  displayOrder = VALUES(displayOrder);

-- Insert sample tags
INSERT INTO g_tags (name, color, description, createdBy) VALUES
('Development', '#2196F3', 'Development related items', 1),
('Testing', '#4CAF50', 'Testing related items', 1),
('Production', '#F44336', 'Production related items', 1),
('Maintenance', '#FF9800', 'Maintenance related items', 1)
ON DUPLICATE KEY UPDATE
  color = VALUES(color),
  description = VALUES(description);

-- Insert sample message templates
INSERT INTO g_message_templates (name, subject, content, isEnabled, createdBy) VALUES
('welcome_email', 'Welcome to our platform!', 'Hello {{name}}, welcome to our platform. We are excited to have you!', 1, 1),
('password_reset', 'Password Reset Request', 'Hello {{name}}, you have requested a password reset. Click here: {{reset_link}}', 1, 1),
('maintenance_notice', 'Scheduled Maintenance', 'Dear users, we will be performing maintenance on {{date}} from {{start_time}} to {{end_time}}.', 1, 1)
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  content = VALUES(content),
  isEnabled = VALUES(isEnabled);

-- Insert sample account whitelist entries
INSERT INTO g_account_whitelist (accountId, purpose, isEnabled, createdBy) VALUES
('test_account_001', 'Development testing account', 1, 1),
('test_account_002', 'QA testing account', 1, 1),
('admin_account_001', 'Admin testing account', 1, 1)
ON DUPLICATE KEY UPDATE
  purpose = VALUES(purpose),
  isEnabled = VALUES(isEnabled);

-- Insert sample IP whitelist entries
INSERT INTO g_ip_whitelist (ipAddress, description, isEnabled, createdBy) VALUES
('127.0.0.1', 'Localhost for development', 1, 1),
('192.168.1.0/24', 'Local network range', 1, 1),
('10.0.0.0/8', 'Internal network range', 1, 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  isEnabled = VALUES(isEnabled);

-- Insert sample job types
INSERT INTO g_job_types (name, displayName, description, jobSchema, isEnabled, createdBy) VALUES
('test_job', 'Test Job', 'Simple test job for development', '{"message": {"type": "string", "required": true, "description": "Test message"}}', 1, 1),
('email_job', 'Email Job', 'Send email notifications', '{"to": {"type": "string", "required": true}, "subject": {"type": "string", "required": true}, "body": {"type": "string", "required": true}}', 1, 1)
ON DUPLICATE KEY UPDATE
  displayName = VALUES(displayName),
  description = VALUES(description),
  jobSchema = VALUES(jobSchema),
  isEnabled = VALUES(isEnabled);
