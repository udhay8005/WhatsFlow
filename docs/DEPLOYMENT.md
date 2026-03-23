# WhatsFlow - Deployment Guide

**Version:** 1.0.1
**Author:** Udhaya Chandra SA
**Last Updated:** March 2026

---

## Using the Pre-built Installer

The easiest way to deploy WhatsFlow is using the pre-built installer.

### Available Builds
- `WhatsFlow 1.0.1.exe` — Portable executable (no install needed)
- `WhatsFlow Setup 1.0.1.exe` — Installer (creates desktop & Start Menu shortcuts)

**Recommended:** Use `WhatsFlow Setup 1.0.1.exe` for a proper installation.

> **Note:** The `dist/win-unpacked/` folder (325 MB) is excluded from version control.
> Build from source if you need the raw unpacked output.

---

## Building from Source

### Prerequisites
- Node.js v20+
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
1. Compiles the React frontend → `frontend/dist/`
2. Rebuilds native SQLite module for Electron
3. Packages everything into `dist/WhatsFlow Setup 1.0.1.exe` and `dist/WhatsFlow 1.0.1.exe`

> **Note:** `asar` is disabled (`"asar": false` in package.json) to ensure `express.static()`
> can correctly serve the frontend files from the filesystem.

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
      "createStartMenuShortcut": true,
      "uninstallDisplayName": "WhatsFlow"
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
Starts Electron with `NODE_ENV=production`. Requires `frontend/dist/` to exist (run
`npm run build:frontend` first).

### With Tunnel (Webhook support via command line)
```powershell
npm run start:tunnel
```
Same as production, plus starts LocalTunnel for a public webhook URL. The tunnel can also
be started and stopped at runtime from the Settings UI — see "Runtime Tunnel Management"
below.

---

## Runtime Tunnel Management

The tunnel can be started and stopped from within the app without restarting the server:

1. Open **Settings → WhatsApp API** tab.
2. Scroll to the **Webhook Configuration** section.
3. Click **Start Tunnel** — the webhook URL appears once the tunnel is active (usually
   3-10 seconds).
4. Copy the URL using the **Copy** button and paste it into Meta Developer Console.
5. Click **Stop Tunnel** when the tunnel is no longer needed.

This is the recommended approach for day-to-day use. The command-line
`npm run start:tunnel` is still available but starts the tunnel at process launch rather
than on demand.

---

## Database Management

The app uses SQLite with **WAL (Write-Ahead Logging)** mode for performance.

- **Location (development):** `database.sqlite` in the project root
- **Location (packaged/installed app):** `%APPDATA%\WhatsFlow\database.sqlite`
  (i.e. `app.getPath('userData')` — set via `WHATSFLOW_USER_DATA` env var by `electron/main.js`)
- **Auto-created:** Schema initializes automatically on first run
- **Backup:** Copy `database.sqlite` while the app is not running

> `database.sqlite-shm` and `database.sqlite-wal` are SQLite WAL auxiliary files. They are
> safe to delete when the app is fully stopped — they will be recreated automatically on the
> next start. Do not delete them while the app is running.

---

## Port Configuration

Default port: **3000**

To change:
```powershell
$env:PORT=3001
npm run start:prod
```

> If port 3000 is already in use when starting the packaged app, the error is logged
> and the process exits cleanly (`process.exit(1)`). To free the port and relaunch:
> ```powershell
> npx kill-port 3000
> ```

---

**For configuration details, see [CONFIGURATION.md](./CONFIGURATION.md)**
**For troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
