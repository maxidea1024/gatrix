-- Drop the old g_remote_config_api_tokens table as it's no longer used
-- All API tokens are now managed through g_api_access_tokens table

DROP TABLE IF EXISTS g_remote_config_api_tokens;
