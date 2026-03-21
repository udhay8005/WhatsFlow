@echo off
setlocal

title WhatsFlow - Production Mode

cls
echo ====================================
echo      WhatsFlow - Starting...
echo ====================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [ERROR] Dependencies not installed!
    echo.
    echo Please run SETUP.bat first to install dependencies.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

REM Check if frontend is built
if not exist "frontend\dist\" (
    echo [WARNING] Frontend not built!
    echo.
    echo Building frontend now, please wait...
    pushd frontend
    call npm run build
    popd
    if errorlevel 1 (
        echo [ERROR] Frontend build failed!
        echo Please run SETUP.bat to fix this.
        echo.
        pause
        exit /b 1
    )
    echo [OK] Frontend built successfully
    echo.
)

echo Backend will run on http://localhost:3000
echo Tunnel URL: https://whatsflow-dakshin.loca.lt/webhook
echo.
echo Starting application...
echo.
echo *** DO NOT CLOSE THIS WINDOW ***
echo The app will open in a new window shortly
echo.
echo ====================================
echo.

npm run start:prod

REM If app exits, show message
echo.
echo ====================================
echo   Application Closed
echo ====================================
echo.
echo Press any key to exit...
pause >nul
