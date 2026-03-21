@echo off
REM Database Backup Script for Windows
REM Schedule with Task Scheduler for daily backups

SET BACKUP_DIR=backup
SET DB_FILE=database.sqlite
SET DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
SET DATE=%DATE: =0%
SET BACKUP_FILE=%BACKUP_DIR%\whatsflow_backup_%DATE%.sqlite

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo Starting database backup...
sqlite3 %DB_FILE% ".backup '%BACKUP_FILE%'"

if %ERRORLEVEL% EQU 0 (
    echo Backup successful: %BACKUP_FILE%
    
    REM Keep only last 7 backups
    forfiles /P "%BACKUP_DIR%" /M whatsflow_backup_*.sqlite /D -7 /C "cmd /c del @path" 2>nul
    echo Old backups cleaned up
) else (
    echo Backup failed!
    exit /b 1
)
