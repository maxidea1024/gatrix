-- Add icon_color column to lexicon events table
ALTER TABLE g_argus_lexicon_events ADD COLUMN icon_color VARCHAR(20) NULL AFTER icon;
