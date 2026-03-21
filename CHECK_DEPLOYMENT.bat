@echo off
REM WhatsFlow Production Deployment Checklist Script
REM Run this before deploying to production

echo ====================================
echo WhatsFlow Production Readiness Check
echo ====================================
echo.

REM Check 1: Node Environment
echo [1/10] Checking NODE_ENV...
if "%NODE_ENV%"=="production" (
    echo [OK] NODE_ENV is set to production
) else (
    echo [WARNING] NODE_ENV is not set to production
    echo Run: set NODE_ENV=production
)
echo.

REM Check 2: Database exists
echo [2/10] Checking database...
if exist "database.sqlite" (
    echo [OK] Database file exists
) else (
    echo [WARNING] Database file not found
)
echo.

REM Check 3: Frontend build
echo [3/10] Checking frontend build...
if exist "frontend\dist\index.html" (
    echo [OK] Frontend build exists
) else (
    echo [ERROR] Frontend not built
    echo Run: npm run build:frontend
)
echo.

REM Check 4: Logs directory
echo [4/10] Checking logs directory...
if exist "backend\logs" (
    echo [OK] Logs directory exists
) else (
    echo [WARNING] Logs directory not found, will be created automatically
)
echo.

REM Check 5: Uploads directory
echo [5/10] Checking uploads directory...
if exist "backend\uploads" (
    echo [OK] Uploads directory exists
) else (
    echo [WARNING] Uploads directory not found, will be created automatically
)
echo.

REM Check 6: Dependencies installed
echo [6/10] Checking node_modules...
if exist "node_modules" (
    echo [OK] Dependencies installed
) else (
    echo [ERROR] Dependencies not installed
    echo Run: npm install
)
echo.

REM Check 7: Test database connection
echo [7/10] Testing database connection...
node -e "const sqlite3 = require('sqlite3'); const db = new sqlite3.Database('./database.sqlite'); db.get('SELECT 1', (err, row) => { if (err) { console.log('[ERROR] Database connection failed'); process.exit(1); } else { console.log('[OK] Database connection successful'); db.close(); } });"
echo.

REM Check 8: Winston logger
echo [8/10] Checking Winston logger...
if exist "backend\utils\logger.js" (
    echo [OK] Logger module exists
) else (
    echo [ERROR] Logger module not found
)
echo.

REM Check 9: Error handler
echo [9/10] Checking error handler...
if exist "backend\middleware\errorHandler.js" (
    echo [OK] Error handler exists
) else (
    echo [ERROR] Error handler not found
)
echo.

REM Check 10: Test suites
echo [10/10] Checking test coverage...
if exist "jest.config.js" (
    echo [OK] Jest configuration exists
    echo Run: npm test (to verify)
) else (
    echo [WARNING] Jest not configured
)
echo.

echo ====================================
echo Deployment Readiness Summary
echo ====================================
echo.
echo Next Steps:
echo 1. Configure WhatsApp credentials in Settings
echo 2. Set up SMTP for email fallback
echo 3. Configure webhook verify token
echo 4. Add App Secret for webhook validation
echo 5. Test with small campaign first
echo 6. Monitor logs/error.log for issues
echo.
echo Ready to start? Run: npm run start:prod
echo.
pause
