@echo off
echo =====================================================
echo Gate Project Database Setup
echo =====================================================
echo.
echo This script will create the 'uwo_gate' database and 'motif_dev' user.
echo Please make sure MySQL server is running.
echo.

REM Check if MySQL is accessible
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: MySQL command not found. Please ensure MySQL is installed and added to PATH.
    echo.
    echo You can also run the SQL script manually:
    echo mysql -u root -p ^< scripts\setup-database.sql
    pause
    exit /b 1
)

echo Enter MySQL root password when prompted...
echo.

REM Execute the SQL script
mysql -u root -p < "%~dp0setup-database.sql"

if %errorlevel% equ 0 (
    echo.
    echo =====================================================
    echo Database setup completed successfully!
    echo =====================================================
    echo.
    echo Database: uwo_gate
    echo User: motif_dev
    echo Password: dev123$
    echo.
    echo You can now run the application with:
    echo   yarn dev
    echo.
) else (
    echo.
    echo =====================================================
    echo Database setup failed!
    echo =====================================================
    echo.
    echo Please check the error messages above and try again.
    echo.
)

pause
