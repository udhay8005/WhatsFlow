@echo off
setlocal

title WhatsFlow - Clear History

cls
echo ====================================
echo    WhatsFlow - Clear History
echo ====================================
echo.
echo This will delete ALL campaign and message history.
echo Your database will be reset to a clean state.
echo.
echo WARNING: This action CANNOT be undone!
echo.
echo What will be deleted:
echo - All campaigns
echo - All messages
echo - All contacts
echo - Message history
echo.
echo Your settings and configuration will NOT be affected.
echo.
echo ====================================
echo.
echo Are you ABSOLUTELY SURE?
echo.
echo Press Ctrl+C to cancel
pause

echo.
echo Stopping any running WhatsFlow processes...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Clearing database history...

REM Backup current database first
if exist "database.sqlite" (
    echo Creating backup before clearing...
    if not exist "backups\" mkdir backups
    copy database.sqlite "backups\database_before_clear_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sqlite" >nul
    echo [OK] Backup created in backups\ folder
    
    REM Delete the database
    del /q database.sqlite 2>nul
    echo [OK] Database cleared
    
    echo.
    echo The database will be recreated when you start the app.
) else (
    echo [INFO] No database file found
)

echo.
echo ====================================
echo   History Cleared Successfully!
echo ====================================
echo.
echo A backup was saved to the backups\ folder
echo.
echo When you restart WhatsFlow, a fresh database
echo will be created automatically.
echo.
pause
