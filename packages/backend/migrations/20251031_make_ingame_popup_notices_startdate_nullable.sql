-- Make startDate nullable in g_ingame_popup_notices table
-- This allows notices to start immediately without specifying a start date

ALTER TABLE g_ingame_popup_notices 
MODIFY COLUMN startDate TIMESTAMP NULL COMMENT 'Start date and time for the notice (optional, starts immediately if null)';

