@echo off
echo =====================================================
echo Starting MySQL with Docker
echo =====================================================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker first: https://docs.docker.com/get-docker/
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running
    echo Please start Docker first
    pause
    exit /b 1
)

REM MySQL container configuration
set CONTAINER_NAME=gatrix-mysql
set MYSQL_ROOT_PASSWORD=root123
set MYSQL_DATABASE=uwo_gate
set MYSQL_USER=motif_dev
set MYSQL_PASSWORD=dev123$
set MYSQL_PORT=3306

REM Check if container already exists
docker ps -a --format "table {{.Names}}" | findstr /B "%CONTAINER_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo MySQL container '%CONTAINER_NAME%' already exists.
    
    REM Check if it's running
    docker ps --format "table {{.Names}}" | findstr /B "%CONTAINER_NAME%" >nul 2>&1
    if %errorlevel% equ 0 (
        echo Container is already running.
    ) else (
        echo Starting existing container...
        docker start %CONTAINER_NAME%
    )
) else (
    echo Creating and starting new MySQL container...
    docker run -d ^
        --name %CONTAINER_NAME% ^
        -e MYSQL_ROOT_PASSWORD=%MYSQL_ROOT_PASSWORD% ^
        -e MYSQL_DATABASE=%MYSQL_DATABASE% ^
        -e MYSQL_USER=%MYSQL_USER% ^
        -e MYSQL_PASSWORD=%MYSQL_PASSWORD% ^
        -p %MYSQL_PORT%:3306 ^
        mysql:8.0 ^
        --character-set-server=utf8mb4 ^
        --collation-server=utf8mb4_unicode_ci
)

echo.
echo Waiting for MySQL to be ready...
timeout /t 10 /nobreak >nul

REM Wait for MySQL to be ready
for /L %%i in (1,1,30) do (
    docker exec %CONTAINER_NAME% mysqladmin ping -h localhost --silent >nul 2>&1
    if %errorlevel% equ 0 (
        echo MySQL is ready!
        goto :ready
    )
    echo Waiting for MySQL... (%%i/30)
    timeout /t 2 /nobreak >nul
)

:ready
echo.
echo =====================================================
echo MySQL Docker Container Started Successfully!
echo =====================================================
echo.
echo Container Name: %CONTAINER_NAME%
echo MySQL Port: %MYSQL_PORT%
echo Root Password: %MYSQL_ROOT_PASSWORD%
echo Database: %MYSQL_DATABASE%
echo User: %MYSQL_USER%
echo Password: %MYSQL_PASSWORD%
echo.
echo Connection string:
echo mysql -h localhost -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASSWORD% %MYSQL_DATABASE%
echo.
echo To stop the container:
echo docker stop %CONTAINER_NAME%
echo.
echo To remove the container:
echo docker rm %CONTAINER_NAME%
echo.

pause
