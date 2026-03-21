@echo off
setlocal
title WhatsFlow - Fresh Installation

cls
echo ====================================
echo   WhatsFlow - Fresh Installation
echo ====================================
echo.
echo This script will set up WhatsFlow from scratch on a new PC.
echo.
echo It will check for:
echo 1. Node.js (and install if missing)
echo 2. Project Dependencies
echo 3. Native Module Build
echo 4. Frontend Build
echo.
echo Press Ctrl+C to cancel, or any key to start...
pause >nul

echo.
echo [1/5] Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Node.js is NOT installed!
    echo Attempting to install Node.js (LTS) via Winget...
    echo.
    where winget >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Winget is not found. Cannot auto-install Node.js.
        echo Please manually install Node.js from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    winget install OpenJS.NodeJS.LTS
    
    echo.
    echo Node.js installed. We need to restart the script to refresh PATH.
    echo Please close this window and run FRESH_INSTALL.bat again.
    pause
    exit /b 0
) else (
    echo [OK] Node.js is installed.
    node --version
)

echo.
echo [2/5] Cleaning old files (if any)...
if exist "node_modules\" rmdir /s /q "node_modules"
if exist "package-lock.json" del /q "package-lock.json"
if exist "frontend\node_modules\" rmdir /s /q "frontend\node_modules"

echo.
echo [3/5] Installing Dependencies...
echo This may take 5-10 minutes...
call npm install --loglevel=error
if errorlevel 1 (
    echo [ERROR] Dependency installation failed!
    pause
    exit /b 1
)

echo.
echo [4/5] Rebuilding Native Modules (SQLite)...
call npx electron-builder install-app-deps
if errorlevel 1 (
    echo [WARNING] Electron rebuild failed. Retrying manually...
    call npm rebuild sqlite3 --build-from-source --runtime=electron --target=33.0.0 --dist-url=https://electronjs.org/headers
)

echo.
echo [5/5] Building Frontend...
pushd frontend
call npm install --loglevel=error
call npm run build
popd

echo.
echo ====================================
echo   Installation Complete!
echo ====================================
echo.
echo You are ready to go!
echo.
echo To start the app:
echo   Double-click START_WHATSFLOW.bat
echo.
echo Press any key to close...
pause >nul
