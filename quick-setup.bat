@echo off
setlocal enabledelayedexpansion

echo ========================================
echo PostgreSQL Database Setup for TZBot
echo ========================================
echo.

REM Prompt for password
set /p "DBPASS=Enter your PostgreSQL password: "

echo.
echo Testing connection and creating database...
echo.

REM Set password for psql
set "PGPASSWORD=%DBPASS%"

REM Test connection
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "SELECT 1 AS test;" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Cannot connect to PostgreSQL with provided password
    echo Please check your password and try again
    pause
    exit /b 1
)

echo [OK] Connected to PostgreSQL

REM Create database
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE tzbot_dev;" 2>nul
if errorlevel 1 (
    echo [INFO] Database 'tzbot_dev' already exists or could not be created
) else (
    echo [OK] Database 'tzbot_dev' created
)

REM Update .env file
echo.
echo Updating .env file...
powershell -Command "$content = Get-Content '.env' -Raw; $content = $content -replace 'DATABASE_URL=postgresql://postgres:.*?@', 'DATABASE_URL=postgresql://postgres:%DBPASS%@'; $content | Set-Content '.env' -NoNewline"

echo [OK] .env file updated
echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Your database is ready. Run: npm run dev
echo.
pause
