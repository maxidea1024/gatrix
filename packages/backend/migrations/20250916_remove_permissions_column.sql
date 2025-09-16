-- Remove permissions column from g_api_access_tokens table
-- This migration removes the permissions column as token permissions are now determined by token type

-- Remove permissions column
ALTER TABLE g_api_access_tokens DROP COLUMN permissions;

-- Update token type enum to remove 'admin' type
ALTER TABLE g_api_access_tokens MODIFY COLUMN tokenType ENUM('client', 'server') NOT NULL;
