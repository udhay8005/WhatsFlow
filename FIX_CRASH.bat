@echo off
setlocal
title WhatsFlow - Fix Crash (Rebuild Dependencies)

cls
echo ====================================
echo   WhatsFlow - Fix Fatal Error
echo ====================================
echo.
echo This script fixes the "FATAL ERROR: napi_throw" crash.
echo It will:
echo 1. Delete node_modules
echo 2. Reinstall dependencies
echo 3. Rebuild sqlite3 for Electron
echo.
echo This may take 5-10 minutes. Please be patient.
echo.
echo Press Ctrl+C to cancel, or any key to start...
pause >nul

echo.
echo [1/3] Cleaning up old dependencies...
if exist "node_modules\" (
    rmdir /s /q "node_modules"
    echo [OK] Deleted node_modules
)
if exist "package-lock.json" (
    del /q "package-lock.json"
    echo [OK] Deleted package-lock.json
)

echo.
echo [2/3] Installing dependencies (this takes time)...
call npm install --loglevel=error
if errorlevel 1 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)
echo [OK] Dependencies installed

echo.
echo [3/3] Rebuilding native modules for Electron...
echo This is the most important step...
call npx electron-builder install-app-deps
if errorlevel 1 (
    echo [ERROR] Rebuild failed!
    echo Trying alternative rebuild method...
    call npm rebuild sqlite3 --build-from-source --runtime=electron --target=33.0.0 --dist-url=https://electronjs.org/headers
)

echo.
echo ====================================
echo   Fix Complete!
echo ====================================
echo.
echo Try running the app now:
echo   npm run start:prod
echo.
echo Press any key to close...
pause >nul
