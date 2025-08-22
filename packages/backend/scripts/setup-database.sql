-- =====================================================
-- Gate Project Database Setup Script
-- =====================================================
-- This script creates the database and user for the Gate project
-- Run this script as MySQL root user

-- Create database
CREATE DATABASE IF NOT EXISTS uwo_gate 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user if not exists (MySQL 5.7+)
CREATE USER IF NOT EXISTS 'motif_dev'@'localhost' IDENTIFIED BY 'dev123$';
CREATE USER IF NOT EXISTS 'motif_dev'@'%' IDENTIFIED BY 'dev123$';

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON uwo_gate.* TO 'motif_dev'@'localhost';
GRANT ALL PRIVILEGES ON uwo_gate.* TO 'motif_dev'@'%';

-- Grant additional privileges for development
GRANT CREATE, ALTER, DROP, INDEX ON uwo_gate.* TO 'motif_dev'@'localhost';
GRANT CREATE, ALTER, DROP, INDEX ON uwo_gate.* TO 'motif_dev'@'%';

-- Refresh privileges
FLUSH PRIVILEGES;

-- Show created database and user
SHOW DATABASES LIKE 'uwo_gate';
SELECT User, Host FROM mysql.user WHERE User = 'motif_dev';

-- Test connection (optional)
USE uwo_gate;
SHOW TABLES;

-- Display success message
SELECT 'Database setup completed successfully!' AS Status;
