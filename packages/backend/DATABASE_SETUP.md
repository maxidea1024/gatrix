# Database Setup Guide

This guide will help you set up the MySQL database for the Gatrix project.

## Prerequisites

- MySQL Server 5.7+ or 8.0+
- MySQL client tools installed
- MySQL server running on localhost:3306

## Quick Setup

### Option 1: Automated Script (Recommended)

#### Windows:
```bash
# Run the batch script
yarn setup:db:win

# Or directly
scripts\setup-database.bat
```

#### Linux/macOS:
```bash
# Run the shell script
yarn setup:db:unix

# Or directly
bash scripts/setup-database.sh
```

#### Cross-platform:
```bash
# Direct MySQL command (requires MySQL client in PATH)
yarn setup:db
```

### Option 2: Manual Setup

1. **Connect to MySQL as root:**
   ```bash
   mysql -u root -p
   ```

2. **Run the SQL commands:**
   ```sql
   -- Create database
   CREATE DATABASE IF NOT EXISTS uwo_gate 
   CHARACTER SET utf8mb4 
   COLLATE utf8mb4_unicode_ci;

   -- Create user
   CREATE USER IF NOT EXISTS 'motif_dev'@'localhost' IDENTIFIED BY 'dev123$';
   CREATE USER IF NOT EXISTS 'motif_dev'@'%' IDENTIFIED BY 'dev123$';

   -- Grant privileges
   GRANT ALL PRIVILEGES ON uwo_gate.* TO 'motif_dev'@'localhost';
   GRANT ALL PRIVILEGES ON uwo_gate.* TO 'motif_dev'@'%';

   -- Refresh privileges
   FLUSH PRIVILEGES;
   ```

3. **Verify setup:**
   ```sql
   SHOW DATABASES LIKE 'uwo_gate';
   SELECT User, Host FROM mysql.user WHERE User = 'motif_dev';
   ```

## Database Configuration

The application uses the following database configuration (from `.env`):

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=uwo_gate
DB_USER=motif_dev
DB_PASSWORD=dev123$
```

## Next Steps

After setting up the database:

1. **Run migrations:**
   ```bash
   yarn migrate:up
   ```

2. **Seed initial data:**
   ```bash
   yarn seed:run
   ```

3. **Start the application:**
   ```bash
   yarn dev
   ```

## Troubleshooting

### Common Issues

1. **"Access denied for user 'motif_dev'"**
   - Make sure the user was created with correct privileges
   - Check if the password matches the `.env` file

2. **"Unknown database 'uwo_gate'"**
   - Run the database setup script again
   - Verify the database was created: `SHOW DATABASES;`

3. **"Can't connect to MySQL server"**
   - Make sure MySQL server is running
   - Check the host and port in `.env` file

4. **"mysql command not found"**
   - Install MySQL client tools
   - Add MySQL to your system PATH

### Manual Verification

Test the connection manually:
```bash
mysql -h localhost -P 3306 -u motif_dev -p uwo_gate
```

If successful, you should see:
```
Welcome to the MySQL monitor...
mysql> 
```

## Security Notes

- The default password `dev123$` is for development only
- Change the password for production environments
- Consider using environment-specific credentials
- Restrict user privileges in production
