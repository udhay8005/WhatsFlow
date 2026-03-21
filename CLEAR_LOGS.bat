@echo off
setlocal

title WhatsFlow - Clear Logs

cls
echo ====================================
echo      WhatsFlow - Clear Logs
echo ====================================
echo.
echo This will delete all log files.
echo.
echo WARNING: This action cannot be undone!
echo.
echo Press Ctrl+C to cancel
pause

echo.
echo Clearing log files...

REM Clear backend logs (if they exist)
if exist "backend\logs\*.log" (
    del /q "backend\logs\*.log" 2>nul
    echo [OK] Backend logs cleared
) else (
    echo [INFO] No backend logs found
)

REM Clear any root-level log files
if exist "*.log" (
    del /q "*.log" 2>nul
    echo [OK] Root log files cleared
) else (
    echo [INFO] No root log files found
)

echo.
echo ====================================
echo   Logs Cleared Successfully!
echo ====================================
echo.
pause
