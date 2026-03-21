# WhatsFlow - Professional WhatsApp Bulk Messaging Platform

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Electron-lightgrey.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)
![Author](https://img.shields.io/badge/author-Udhaya%20Chandra%20SA-green.svg)

## Overview

WhatsFlow is a professional-grade, locally hosted WhatsApp bulk messaging desktop application. It enables businesses to securely send template-based messages to thousands of contacts with dynamic media attachments, utilizing the official Meta WhatsApp Business API.

By combining the convenience of a desktop application with the power of a modern web stack, WhatsFlow offers real-time analytics, automated background queuing, and reliable delivery mechanisms including automatic email fallbacks.

---

## Key Features

- **Bulk Template Messaging:** Utilize Meta-approved WhatsApp templates to send customized bulk campaigns.
- **Dynamic Media Attachments:** Attach campaign-specific images (JPG, PNG) or videos (MP4) up to 16MB.
- **Background Queue Processing:** A dedicated background worker (`worker.js`) reliably processes messages, enforces rate limits (TPS), and handles automatic retries.
- **Smart Email Fallback:** Automatically switches to SMTP email delivery if WhatsApp delivery fails after maximum retry attempts.
- **Real-time Analytics Dashboard:** Monitor message delivery statuses, read receipts, and campaign trends visually using Recharts with full dark/light mode support.
- **Live Webhook Integration:** Integrates `localtunnel` to receive secure, real-time status updates (Sent, Delivered, Read, Failed) directly from Meta's webhooks, even while running on localhost.
- **Excel Contact Import:** Seamlessly import and map contacts and variables from Excel/CSV files.
- **Blacklist Management:** Block specific phone numbers from receiving future campaigns.
- **Enterprise-Grade Security:** Utilizes AES-256 encryption for sensitive API credentials and HMAC-SHA256 for webhook signature validation.
- **Modern UI:** A responsive React 19 frontend built with Vite and Tailwind CSS, featuring full Dark/Light mode support with theme-aware charts.

---

## Architecture & Tech Stack

WhatsFlow employs a hybrid process model, bundling a complete Client-Server architecture within an Electron shell.

### Desktop Shell (Electron)
- **Main Process:** Manages the app lifecycle (`electron/main.js`), starts the Express backend, and renders the Chromium frontend window.
- **Security:** `contextIsolation`, `sandbox`, no `nodeIntegration` for the renderer.

### Backend (Node.js & Express)
- **RESTful API:** Core engine (`backend/server.js`) handling campaigns, contacts, media, and settings.
- **WebSockets (Socket.io):** Pushes real-time updates (campaign progress, webhook events) to the React frontend.
- **Background Worker (`backend/worker.js`):** Polls for queued messages, enforces TPS rate limits, manages email fallback.
- **Tunnel Manager (`backend/tunnelManager.js`):** Provisions public URLs using LocalTunnel for Meta webhooks.

### Frontend (React 19, Vite, JSX/TypeScript)
- **Framework:** React 19 powered by Vite with HMR.
- **Styling:** Tailwind CSS — responsive, dark/light mode aware.
- **Real-time:** `socket.io-client` for live dashboard updates.
- **Charts:** `Recharts` with `useTheme()` integration for dark/light adaptive colors.

### Database (SQLite)
- **WAL Mode:** Write-Ahead Logging for high concurrent read/write performance.
- **Encryption:** AES-256-CBC for all sensitive config values stored in the database.

---

## Project Structure

```text
whatsflow/
├── backend/                  # Node.js Express API & Background Services
│   ├── __tests__/            # Backend unit & integration tests
│   ├── middleware/           # Auth, Error Handling, Validators
│   ├── routes/               # API endpoint definitions
│   ├── services/             # WhatsApp API, Email SMTP, Crypto
│   ├── utils/                # Winston logger
│   ├── cron.js               # Scheduled tasks
│   ├── database.js           # SQLite initialization & schema
│   ├── server.js             # Express & Socket.IO entry point
│   ├── tunnelManager.js      # LocalTunnel webhook management
│   └── worker.js             # Background message queue processor
├── electron/                 # Desktop Application Shell
│   ├── main.js               # Electron main process
│   └── preload.js            # Secure context bridge
├── frontend/                 # React UI Application
│   ├── src/
│   │   ├── components/       # Layout, Toast, Charts, Campaign wizard
│   │   ├── contexts/         # ThemeContext, SocketContext
│   │   ├── pages/            # Dashboard, NewCampaign, History, Blacklist, Settings
│   │   ├── services/         # Axios API client (api.ts)
│   │   └── utils/            # Excel parser, contact processor
│   └── vite.config.js        # Bundler + dev proxy configuration
├── docs/                     # Extended documentation
├── tests/                    # E2E tests (Playwright)
├── .env.template             # Environment variable template
├── .gitignore                # Comprehensive exclusion rules
└── database.sqlite           # Local SQLite database (auto-generated)
```

---

## Installation & Setup

### Prerequisites
- **Node.js:** v18.x or higher
- **Meta Business Account:** Active WhatsApp API access and verified phone number.
- **OS:** Windows 10/11

### Using the Pre-built Installer (Recommended)

1. Download `WhatsFlow Setup 1.0.1.exe` from the `dist/` folder.
2. Run the installer — it creates a desktop shortcut and Start Menu entry.
3. Launch **WhatsFlow** and configure credentials in Settings.

### Local Development

```powershell
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Configure environment (optional)
copy .env.template .env

# 3. Start in development mode
npm run dev
```

### Building the Executable

```powershell
# Single command — builds frontend then packages Electron exe
npm run build

# Output in dist/:
#   WhatsFlow 1.0.1.exe          (portable)
#   WhatsFlow Setup 1.0.1.exe    (installer)
```

### First-Time Configuration
1. Open the app and navigate to **Settings -> WhatsApp API**.
2. Enter your Meta credentials: `Access Token`, `Phone Number ID`, `WABA ID`, `App Secret`, `Verify Token`.
3. Save — green checkmarks confirm each field is configured.
4. *(Optional)* Configure **Email Fallback** (SMTP) for failed message handling.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Full development mode (backend + frontend + Electron) |
| `npm run server` | Backend only (port 3000) |
| `npm run frontend` | Vite dev server only (port 5173) |
| `npm run start:prod` | Production Electron app (no tunnel) |
| `npm run start:tunnel` | Production + LocalTunnel webhook URL |
| `npm run build` | Build frontend + package Electron exe |
| `npm run build:frontend` | Build React frontend to `frontend/dist/` |
| `npm test` | Jest test suite with coverage |
| `npm run test:unit` | Backend unit tests only |

---

## Security Posture

- **Encryption at Rest:** All sensitive API tokens and SMTP passwords encrypted using AES-256-CBC before SQLite storage.
- **Webhook Integrity:** Incoming Meta webhooks verified via HMAC-SHA256 signatures against the configured App Secret.
- **API Authentication:** Session-based X-API-Key required for all `/api/*` routes (issued by `/auth/token`).
- **Input Validation:** All inputs validated via `express-validator` middleware to prevent injection attacks.
- **Electron Hardening:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.

---

## Support & Troubleshooting

- **Application Logs:** Check `backend/logs/combined.log` and `backend/logs/error.log`.
- **Port Conflicts:** If port 3000 is in use, the app logs the error gracefully — close other instances first.
- **Database Locks:** Ensure no external SQLite viewers are locking `database.sqlite` while the worker is running.
- **Webhook Failures:** Verify your `TUNNEL_SUBDOMAIN` is unique and not claimed by another user.

*For deeper architectural insights, refer to `docs/ARCHITECTURE.md`.*

---

**Author:** Udhaya Chandra SA
**Version:** 1.0.1
**Last Updated:** March 2026
