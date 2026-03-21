# WhatsFlow - Deployment Guide

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026

---

## Using the Pre-built Installer

The easiest way to deploy WhatsFlow is using the pre-built installer from the `dist/` folder.

### Files in `dist/`
- `WhatsFlow 1.0.1.exe` — Portable executable (no install needed)
- `WhatsFlow Setup 1.0.1.exe` — Installer (creates desktop & Start Menu shortcuts)

**Recommended:** Use `WhatsFlow Setup 1.0.1.exe` for a proper installation.

---

## Building from Source

### Prerequisites
- Node.js v18+
- npm v9+

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Build the App (Single Command)
```powershell
npm run build
```

This command:
1. Compiles the React frontend -> `frontend/dist/`
2. Rebuilds native SQLite module for Electron
3. Packages everything into `dist/WhatsFlow Setup 1.0.1.exe` and `dist/WhatsFlow 1.0.1.exe`

> **Note:** `asar` is disabled (`"asar": false` in package.json) to ensure `express.static()` can correctly serve the frontend files from the filesystem.

### Build Configuration (`package.json`)
```json
{
  "build": {
    "appId": "com.whatsflow.app",
    "productName": "WhatsFlow",
    "asar": false,
    "files": [
      "electron/**/*",
      "backend/**/*",
      "frontend/dist/**/*",
      "package.json"
    ],
    "win": {
      "target": ["portable", "nsis"],
      "icon": "frontend/public/logo.png"
    },
    "nsis": {
      "oneClick": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

---

## Running from Source (Without Building)

### Development Mode
```powershell
npm run dev
```
Starts backend (port 3000) + frontend (port 5173) + Electron concurrently.

### Production Mode (from source)
```powershell
npm run start:prod
```
Starts Electron with `NODE_ENV=production`. Requires `frontend/dist/` to exist (run `npm run build:frontend` first).

### With Tunnel (Webhook support)
```powershell
npm run start:tunnel
```
Same as production + starts LocalTunnel for public webhook URL.

---

## Database Management

The app uses SQLite with **WAL (Write-Ahead Logging)** mode for performance.

- **Location:** `database.sqlite` in the project root (dev) or app data directory (installed)
- **Auto-created:** Schema initializes automatically on first run
- **Backup:** Copy `database.sqlite` while the app is not running

> **Do not delete** `database.sqlite-shm` and `database.sqlite-wal` while the app is running — these are active WAL files. Stop the app first.

---

## Port Configuration

Default port: **3000**

To change:
```powershell
$env:PORT=3001
npm run start:prod
```

> If port 3000 is already in use when starting the packaged app, the error is logged gracefully (no crash dialog). Close other instances first.

---

**For configuration details, see [CONFIGURATION.md](./CONFIGURATION.md)**
**For troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
