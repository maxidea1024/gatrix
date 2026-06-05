-- Alter assigned_to in g_argus_issues to support string usernames/emails or ULID user IDs
ALTER TABLE g_argus_issues MODIFY COLUMN assigned_to VARCHAR(255) DEFAULT NULL;
