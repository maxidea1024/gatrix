-- Initialize Gate database
-- This script runs when the MySQL container starts for the first time

-- Create database if not exists (should already be created by environment variables)
CREATE DATABASE IF NOT EXISTS gate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE gate;

-- Set timezone
SET time_zone = '+00:00';

-- Create a dedicated user for the application (if not already created by environment variables)
-- This is a backup in case environment variables don't work as expected
CREATE USER IF NOT EXISTS 'gate_user'@'%' IDENTIFIED BY 'gate_password';
GRANT ALL PRIVILEGES ON gate.* TO 'gate_user'@'%';

-- Create test database for testing
CREATE DATABASE IF NOT EXISTS gate_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON gate_test.* TO 'gate_user'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Log initialization
SELECT 'Gate database initialization completed' AS message;
