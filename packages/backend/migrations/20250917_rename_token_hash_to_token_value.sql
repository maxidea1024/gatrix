-- Rename tokenHash column to tokenValue in g_api_access_tokens table
ALTER TABLE g_api_access_tokens RENAME COLUMN tokenHash TO tokenValue;
