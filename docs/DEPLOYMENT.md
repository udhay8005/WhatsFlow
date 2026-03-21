# WhatsFlow - Deployment Guide

## 📦 Build for Production

WhatsFlow is built on **Electron**, **React**, and **Node.js**.

### Prerequisites
- Node.js v18+
- NPM v9+
- Git

### 1. Build Frontend
The React frontend must be compiled to static assets first.
```bash
cd frontend
npm install
npm run build
```
This generates the `frontend/dist` folder.

### 2. Build Electron App
Return to the root directory and create the executable.
```bash
# Install root dependencies
npm install

# Build installer (Windows .exe)
npm run build
```
The output will be in the `dist/` folder (e.g., `WhatsFlow Setup 1.0.0.exe`).

---

## 🖥️ Server Deployment (Headless)

If you wish to run only the backend server (without the Electron UI):

1. **Configure Environment**:
   Create a `.env` file in the root:
   ```env
   NODE_ENV=production
   PORT=3000
   WA_API_VERSION=v19.0
   ```
   *Note: Database credentials are stored in `database.sqlite`.*

2. **Start Server**:
   ```bash
   node backend/server.js
   ```

3. **Process Management**:
   Use PM2 for production reliability:
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name "whatsflow-backend"
   ```

---

## 🛠️ Database Management

The app increases reliability by using **WAL (Write-Ahead Logging)** mode for SQLite.
- **Backup**: Regularly copy `database.sqlite`.
- **Location**:
  - Dev: Project root.
  - Prod: `%APPDATA%/WhatsFlow/database.sqlite` (varies by OS).
