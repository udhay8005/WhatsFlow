# WhatsFlow - Professional WhatsApp Bulk Messaging Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Electron-lightgrey.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

## 📖 Overview

WhatsFlow is a professional-grade, locally hosted WhatsApp bulk messaging desktop application. It enables businesses to securely send template-based messages to thousands of contacts with dynamic media attachments, utilizing the official Meta WhatsApp Business API.

By combining the convenience of a desktop application with the power of a modern web stack, WhatsFlow offers real-time analytics, automated background queuing, and reliable delivery mechanisms including automatic email fallbacks.

---

## ✨ Key Features

- **🚀 Bulk Template Messaging:** Utilize Meta-approved WhatsApp templates to send customized bulk campaigns.
- **📎 Dynamic Media Attachments:** Attach campaign-specific images (JPG, PNG) or videos (MP4) up to 16MB.
- **🔄 Background Queue Processing:** A dedicated background worker (`worker.js`) reliably processes messages, enforces rate limits (TPS), and handles automatic retries.
- **📧 Smart Email Fallback:** Automatically switches to SMTP email delivery if WhatsApp delivery fails after maximum retry attempts.
- **📊 Real-time Analytics Dashboard:** Monitor message delivery statuses, read receipts, and campaign trends visually using Recharts.
- **⚡ Live Webhook Integration:** Integrates `localtunnel` to receive secure, real-time status updates (Sent, Delivered, Read, Failed) directly from Meta's webhooks, even while running on localhost.
- **📁 Excel Contact Import:** Seamlessly import and map contacts and variables from Excel/CSV files.
- **🔐 Enterprise-Grade Security:** Utilizes AES-256 encryption via Electron's `safeStorage` for sensitive API credentials and HMAC-SHA256 for webhook signature validation.
- **🌗 Modern UI:** A responsive React frontend built with Vite and Tailwind CSS, featuring Dark/Light mode support.

---

## 🏗️ Architecture & Tech Stack

WhatsFlow employs a robust hybrid process model, bundling a complete Client-Server architecture within an Electron shell.

### **Desktop Shell (Electron)**
- **Main Process:** Acts as the entry point (`electron/main.js`). It manages the lifecycle of the application, spawns the Express backend server, and renders the Chromium frontend window.
- **Security:** Interfaces with the OS to provide secure storage for encryption keys.

### **Backend (Node.js & Express)**
- **RESTful API:** Serves as the core engine (`backend/server.js`), handling campaigns, contacts, media uploads, and settings.
- **WebSockets (Socket.io):** Pushes real-time updates (like campaign progress and webhook events) to the React frontend.
- **Background Worker (`backend/worker.js`):** Constantly polls the database for 'queued' messages. It strictly adheres to Meta's API rate limits to prevent account bans and manages the email fallback logic.
- **Tunnel Manager (`backend/tunnelManager.js`):** Automatically provisions public URLs using LocalTunnel to accept Meta webhooks.

### **Frontend (React, Vite, TypeScript/JSX)**
- **Framework:** React 18 powered by Vite for lightning-fast HMR and optimized builds.
- **Styling:** Tailwind CSS for a modern, responsive, and utility-first design.
- **Real-time Communication:** `socket.io-client` for live dashboard updates.
- **Data Visualization:** `Recharts` for rendering delivery trends and status distribution charts.

### **Database (SQLite)**
- **Schema:** Relational design managing Campaigns, Messages, Contacts, and App Configurations (`backend/database.js`).
- **Performance:** Configured in **WAL (Write-Ahead Logging)** mode to handle high concurrent read/write operations efficiently, preventing database locks during aggressive queue processing.

---

## 📂 Project Structure

```text
whatsflow/
├── backend/                  # Node.js Express API & Background Services
│   ├── middleware/           # Auth, Error Handling, Validators
│   ├── routes/               # API endpoint definitions
│   ├── services/             # WhatsApp Meta API, Email SMTP, Crypto logic
│   ├── cron.js               # Scheduled tasks
│   ├── database.js           # SQLite Initialization & Schema
│   ├── server.js             # Express & Socket.io entry point
│   ├── tunnelManager.js      # LocalTunnel Webhook management
│   └── worker.js             # Background Message Queue Processor
├── electron/                 # Desktop Application Shell
│   ├── main.js               # Electron main process
│   └── preload.js            # Secure IPC bridge
├── frontend/                 # React UI Application
│   ├── src/
│   │   ├── components/       # Reusable UI elements & Charts
│   │   ├── contexts/         # React Contexts (Theme, Socket)
│   │   ├── pages/            # Application Views (Dashboard, Campaigns, Settings)
│   │   ├── services/         # API & Socket communication
│   │   └── utils/            # Excel parsers & formatters
│   ├── tailwind.config.js    # Styling configuration
│   └── vite.config.js        # Bundler configuration
├── docs/                     # Extended documentation (Architecture, API)
├── scripts/                  # Deployment & testing utilities
├── tests/                    # E2E & Unit tests
└── database.sqlite           # Local SQLite Database (Auto-generated)
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js:** v18.x or higher
- **Meta Business Account:** Active WhatsApp API access and verified phone number.
- **OS:** Windows 10/11 (Optimized for Electron Desktop)

### Local Development Start

1. **Clone & Install Dependencies**
   ```powershell
   git clone https://github.com/udhay8005/WhatsFlow.git
   cd WhatsFlow
   npm install
   ```

2. **Configure Environment (One-time setup)**
   Copy `.env.template` to `.env` and set your preferred localtunnel subdomain.
   ```powershell
   $env:TUNNEL_SUBDOMAIN="whatsflow-yourcompany"
   ```

3. **Start the Application**
   ```powershell
   npm run start:prod
   ```
   *The Electron window will launch automatically once the backend is ready.*

### First-Time Configuration
1. Open the app and navigate to **Settings → WhatsApp API**.
2. Input your Meta App Credentials: `Access Token`, `Phone ID`, `WABA ID`, and `App Secret`.
3. Save the settings. The app will automatically configure your localtunnel webhook with Meta.
4. *(Optional)* Navigate to **Email Fallback** to configure SMTP settings for failed messages.

---

## 📜 Available Scripts

- `npm run start:prod` - Starts the full Electron application (Production mode).
- `npm run dev:backend` - Starts only the backend API with Nodemon.
- `npm run dev:frontend` - Starts the Vite React development server.
- `npm test` - Runs the comprehensive Jest test suite.
- `npm run test:watchAll` - Runs tests in interactive watch mode.

---

## 🔒 Security Posture

- **Data at Rest:** All sensitive API tokens and SMTP passwords are encrypted using `AES-256-GCM` before being stored in SQLite.
- **Webhook Integrity:** Incoming webhook payloads from Meta are strictly verified using `HMAC-SHA256` signatures against the configured App Secret.
- **Input Sanitization:** All user inputs and API requests are validated using custom middleware validators to prevent Injection attacks.

---

## 🤝 Support & Troubleshooting

- **Application Logs:** Check `backend/logs/combined.log` and `backend/logs/error.log` for detailed operational traces.
- **Database Locks:** Ensure no external SQLite viewers are locking `database.sqlite` while the background worker is running.
- **Webhook Failures:** Verify your `TUNNEL_SUBDOMAIN` is unique and not currently hijacked by another localtunnel user.

*For deeper architectural insights, refer to `docs/ARCHITECTURE.md`.*
