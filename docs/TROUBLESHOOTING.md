# WhatsFlow - Troubleshooting Guide

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026
**Purpose:** Resolve common issues and errors

---

## Table of Contents

1. [Installation & Setup Issues](#installation--setup-issues)
2. [Runtime Errors](#runtime-errors)
3. [WhatsApp API Issues](#whatsapp-api-issues)
4. [Webhook Problems](#webhook-problems)
5. [Database Errors](#database-errors)
6. [Performance Issues](#performance-issues)
7. [UI/Frontend Issues](#uifrontend-issues)
8. [Diagnostic Commands](#diagnostic-commands)

---

## 1. Installation & Setup Issues

### Issue: `npm install` fails

**Symptoms:**
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**Solutions:**
```powershell
# 1. Clear npm cache
npm cache clean --force

# 2. Delete lock file and node_modules
Remove-Item -Force -Recurse node_modules, package-lock.json

# 3. Reinstall
npm install

# 4. If still fails, try with --legacy-peer-deps
npm install --legacy-peer-deps
```

---

### Issue: Electron fails to start

**Symptoms:**
```
Error: Cannot find module 'electron'
```

**Solutions:**
```powershell
# Rebuild electron
npm rebuild electron

# Or reinstall electron
npm install electron@33.0.0 --save-dev
```

---

## 2. Runtime Errors

### Issue: "ERR_CONNECTION_REFUSED" when starting prod

**Symptoms:**
- Electron window shows white screen
- Console error: `Failed to load URL: http://localhost:3000/`

**Root Cause:** Backend server not starting

**Solutions:**

**Step 1: Check if frontend is built**
```powershell
ls frontend/dist
# Should show index.html and assets folder
```

If not, build it:
```powershell
npm run build:frontend
```

**Step 2: Check server logs**
```powershell
npm run start:prod
# Look for "Server running on http://localhost:3000"
```

**Step 3: Test backend independently**
```powershell
node backend/server.js
# Visit http://localhost:3000 in browser
```

**Step 4: Check server.js startup condition**
```javascript
// In backend/server.js, verify:
if (require.main === module || process.env.NODE_ENV === 'production') {
    server.listen(PORT, () => {
        logger.info(`Server running on http://localhost:${PORT}`)
    })
}
```

---

### Issue: "Port 3000 is already in use"

> **Note (v1.0.1+):** The packaged app now handles this error gracefully — it logs the conflict and does not show a crash dialog. However, the app will not start correctly until the port is freed.

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

**Option 1: Kill the process**
```powershell
# Find process ID
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess

# Kill it
Stop-Process -Id <PID>
```

**Option 2: Change port**
```powershell
# Set environment variable
$env:PORT=3001
npm run start:prod
```

---

### Issue: App crashes on startup

**Symptoms:**
- Electron window opens then immediately closes
- No error message

**Solutions:**

**Step 1: Check logs**
```powershell
# Backend logs (if Winston is configured)
Get-Content backend/logs/combined.log -Tail 50
```

**Step 2: Run with developer tools**
Edit `electron/main.js`:
```javascript
// Add this line in createWindow()
win.webContents.openDevTools()
```

**Step 3: Check database**
```powershell
# Verify database file exists and is not corrupted
sqlite3 database.sqlite "PRAGMA integrity_check;"
# Should output: ok
```

---

## 3. WhatsApp API Issues

### Issue: "Templates not loading"

**Symptoms:**
- Settings page shows "Not Configured" for WABA ID
- New Campaign page shows "No templates available"

**Root Cause:** Invalid or missing WhatsApp credentials

**Solutions:**

**Step 1: Verify credentials in Meta Business**
1. Go to https://developers.facebook.com/
2. Your App → WhatsApp → API Setup
3. Copy exact values:
   - Phone Number ID
   - WABA ID (from URL)
   - Permanent Access Token

**Step 2: Test API manually**
```powershell
curl "https://graph.facebook.com/v18.0/YOUR_WABA_ID/message_templates" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response:
```json
{
  "data": [
    {
      "name": "hello_world",
      "status": "APPROVED"
    }
  ]
}
```

**Step 3: Check Settings in app**
- Go to Settings → WhatsApp API
- Re-enter all credentials
- Click "Save Configuration"
- Refresh page - checkmarks should turn green

---

### Issue: "Message send failed - 401 Unauthorized"

**Symptoms:**
- Campaign starts but all messages fail
- Error: "Authentication error from WhatsApp API"

**Root Cause:** Expired or invalid access token

**Solutions:**

**Get a new permanent token:**
1. Go to Meta Business → System Users
2. Create System User with "Admin" access
3. Generate new token with these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copy token and update in Settings

---

### Issue: "Message send failed - 400 Template not found"

**Symptoms:**
- Error: "Template 'my_template' does not exist"

**Root Cause:** Template name mismatch or template not approved

**Solutions:**

**Step 1: Verify template exists**
```powershell
curl "https://graph.facebook.com/v18.0/YOUR_WABA_ID/message_templates" `
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 2: Check template status**
- Templates must be `APPROVED` status
- Name must match exactly (case-sensitive)

**Step 3: Re-select template in app**
- New Campaign → Refresh template list
- Select template from dropdown (don't type manually)

---

## 4. Webhook Problems

### Issue: "Webhook verification failed"

**Symptoms:**
- Meta Developer Console shows "Failed to verify webhook"
- Error 403

**Root Cause:** Verify token mismatch

**Solutions:**

**Step 1: Test webhook manually**
```powershell
curl "http://your-domain:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

Expected response: `test123`

**Step 2: Check verify token in Settings**
- Settings → Webhook → Verify Token
- Must match exactly what's in Meta Developer Console

**Step 3: Ensure app is running**
```powershell
npm run start:prod
# Or for localhost testing:
ngrok http 3000
```

---

### Issue: "Webhook signature validation failed"

**Symptoms:**
- Backend logs: "Webhook signature validation failed - rejecting request"
- Messages stuck in "sent" status (no "delivered" update)

**Root Cause:** App Secret missing or incorrect

**Solutions:**

**Step 1: Configure App Secret**
- Settings → WhatsApp API → App Secret
- Get from Meta → App Settings → Basic → App Secret
- Save configuration

**Step 2: Verify signature calculation**
Check backend logs for signature comparison:
```
Received: sha256=abc123...
Expected: sha256=abc123...
```

**Step 3: Test in development mode**
Set `NODE_ENV=development` to skip signature check temporarily:
```powershell
$env:NODE_ENV="development"
npm start
```

---

## 5. Database Errors

### Issue: "Database is locked"

**Symptoms:**
```
Error: SQLITE_BUSY: database is locked
```

**Root Cause:** Multiple processes accessing the database

**Solutions:**

**Step 1: Close all running instances**
```powershell
# Kill all node processes
Get-Process node | Stop-Process -Force

# Kill all electron processes
Get-Process electron | Stop-Process -Force
```

**Step 2: Delete WAL files**
```powershell
Remove-Item database.sqlite-wal, database.sqlite-shm
```

**Step 3: Restart app**
```powershell
npm run start:prod
```

---

### Issue: "Table does not exist"

**Symptoms:**
```
Error: no such table: campaigns
```

**Root Cause:** Database not initialized

**Solutions:**

**Recreate database:**
```powershell
# 1. Backup existing database
Copy-Item database.sqlite database.sqlite.backup

# 2. Delete database
Remove-Item database.sqlite*

# 3. Restart app (will recreate schema)
npm run server
```

---

### Issue: "Database corruption detected"

**Symptoms:**
```
Error: database disk image is malformed
```

**Solutions:**

**Attempt recovery:**
```powershell
sqlite3 database.sqlite ".recover" | sqlite3 database_recovered.sqlite

# Test recovered database
sqlite3 database_recovered.sqlite "SELECT COUNT(*) FROM campaigns;"

# If successful, replace
Move-Item database_recovered.sqlite database.sqlite -Force
```

**If recovery fails, restore from backup:**
```powershell
# Run BACKUP_DATABASE.bat regularly to have backups
# Find latest backup in backups/ folder
Copy-Item backups/database_20260120.sqlite database.sqlite
```

---

## 6. Performance Issues

### Issue: Slow campaign processing

**Symptoms:**
- Messages taking 10+ seconds each to send
- System appears "stuck"

**Root Cause:** Rate limiting too aggressive or network issues

**Solutions:**

**Step 1: Check TPS setting**
- Settings → Worker TPS (Transactions Per Second)
- Increase from 1 to 10-20 for better throughput
- Max safe value: 50 (WhatsApp allows 80 TPS official limit)

**Step 2: Check network**
```powershell
# Test WhatsApp API latency
Measure-Command {
  curl "https://graph.facebook.com/v18.0" | Out-Null
}
# Should be < 500ms
```

**Step 3: Check database performance**
```powershell
sqlite3 database.sqlite
.timer on
SELECT * FROM messages WHERE status = 'queued' LIMIT 100;
# Should be < 50ms
```

---

### Issue: High CPU usage

**Symptoms:**
- Electron using 80%+ CPU
- System becomes unresponsive

**Root Cause:** Infinite loop or excessive polling

**Solutions:**

**Step 1: Check worker sleep interval**
```javascript
// In worker.js, verify:
await new Promise(resolve => setTimeout(resolve, 1000)) // Sleep 1 second
```

**Step 2: Disable unnecessary features temporarily**
- Stop campaign processing during idle time
- Reduce Socket.IO event frequency

**Step 3: Check for memory leaks**
```powershell
# Open Chrome DevTools in Electron
# View → Toggle Developer Tools
# Memory tab → Take heap snapshot
# Look for detached DOM nodes
```

---

## 7. UI/Frontend Issues

### Issue: "Dashboard not updating in real-time"

**Symptoms:**
- Campaign progress stuck at 0%
- Status doesn't update to "delivered"

**Root Cause:** Socket.IO disconnected

**Solutions:**

**Step 1: Check Socket.IO connection**
Open browser console:
```javascript
// Should see:
Socket.IO client connected
```

**Step 2: Verify backend is emitting events**
Check backend logs:
```
info: Socket.IO client connected: ABC123
info: Emitting status_update event
```

**Step 3: Restart both frontend and backend**
```powershell
# Ctrl+C to stop
npm run dev
```

---

### Issue: "Dark mode not persisting"

**Symptoms:**
- Theme resets to light on every app restart

**Root Cause:** localStorage not saving

**Solutions:**

**Step 1: Check browser storage**
- Open DevTools → Application → Local Storage
- Should see `theme: "dark"`

**Step 2: Clear cache and retry**
```javascript
// In browser console
localStorage.clear()
location.reload()
```

**Step 3: Check ThemeContext code**
```javascript
// In ThemeContext.jsx, verify:
localStorage.setItem('theme', newTheme)
```

---

## 8. Diagnostic Commands

### Health Check

```powershell
# 1. Check if backend is running
curl http://localhost:3000/health

# 2. Check database
sqlite3 database.sqlite "SELECT COUNT(*) FROM campaigns;"

# 3. Check logs
Get-Content backend/logs/combined.log -Tail 20

# 4. Check process status
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*electron*"}
```

### Full System Reset

```powershell
# WARNING: This deletes all data!

# 1. Stop all processes
Get-Process node, electron | Stop-Process -Force

# 2. Clear databases
Remove-Item database.sqlite*

# 3. Logs directory is auto-recreated on next start
# (No pre-existing logs to delete in clean install)

# 4. Reinstall dependencies
Remove-Item node_modules, package-lock.json -Force -Recurse
npm install

# 5. Rebuild frontend
cd frontend
Remove-Item node_modules, package-lock.json, dist -Force -Recurse
npm install
npm run build
cd ..

# 6. Start fresh
npm run start:prod
```

---

## Getting Help

If issues persist:
1. **Check logs:** `backend/logs/error.log`
2. **Enable debug mode:** `$env:LOG_LEVEL="debug"`
3. **Run tests:** `npm run test` (look for failing tests)
4. **Check GitHub Issues:** [github.com/your-repo/whatsflow/issues](https://github.com)
5. **Contact support:** support@whatsflow.com

---

**For configuration help, see [USER_GUIDE.md](./USER_GUIDE.md)**  
**For development issues, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)**
