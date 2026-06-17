-- Add icon column to lexicon events table
ALTER TABLE g_argus_lexicon_events ADD COLUMN icon VARCHAR(50) NULL AFTER display_name;
