-- Test script to verify migration log improvements
-- This script drops the migrations table to test the improved logging

USE uwo_gate;

-- Drop migrations table to simulate first-time migration
DROP TABLE IF EXISTS migrations;

-- Show that migrations table no longer exists
SHOW TABLES LIKE 'migrations';

SELECT 'Migrations table dropped. Now run: yarn migrate:up' AS Message;
