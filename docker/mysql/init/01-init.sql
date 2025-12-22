-- Initialize Gatrix database
-- This script runs when the MySQL container starts for the first time

-- Create database if not exists (should already be created by environment variables)
CREATE DATABASE IF NOT EXISTS gatrix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE gatrix;

-- Set timezone
SET time_zone = '+00:00';

-- Create a dedicated user for the application (if not already created by environment variables)
-- This is a backup in case environment variables don't work as expected
CREATE USER IF NOT EXISTS 'gatrix_user'@'%' IDENTIFIED BY 'gatrix_password';
GRANT ALL PRIVILEGES ON gatrix.* TO 'gatrix_user'@'%';

-- Create test database for testing
CREATE DATABASE IF NOT EXISTS gatrix_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON gatrix_test.* TO 'gatrix_user'@'%';

-- Create chat database for chat server
CREATE DATABASE IF NOT EXISTS gatrix_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON gatrix_chat.* TO 'gatrix_user'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Create MySQL exporter user
CREATE USER IF NOT EXISTS 'mysqld_exporter'@'%' IDENTIFIED BY 'exporter_password';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'mysqld_exporter'@'%';
FLUSH PRIVILEGES;

-- Log initialization
SELECT 'Gatrix database initialization completed' AS message;
