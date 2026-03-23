/**
 * @file main.js
 * @description Electron main process entry point for WhatsFlow.
 *              Starts the Express backend (production only), polls the /health
 *              endpoint until ready, then creates the BrowserWindow. Handles
 *              graceful shutdown of the worker and database on before-quit.
 * @module electron/main
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

/**
 * Returns (or generates + saves) a stable per-installation tunnel subdomain.
 * Stored as a 6-char hex string in userData/tunnel-id.txt so it survives app updates.
 * Results in a URL like: https://wf-a1b2c3.loca.lt/webhook
 */
function getStableSubdomain() {
    const idFile = path.join(app.getPath('userData'), 'tunnel-id.txt');
    if (fs.existsSync(idFile)) {
        return fs.readFileSync(idFile, 'utf8').trim();
    }
    const subdomain = 'wf-' + crypto.randomBytes(3).toString('hex');
    fs.writeFileSync(idFile, subdomain, 'utf8');
    return subdomain;
}

// In production, configure and start the backend server in this process
if (!isDev) {
    try {
        process.env.NODE_ENV = 'production';

        // Expose the Electron userData directory to all backend modules via env var.
        // All mutable files — database, logs, uploaded media — are written here so
        // the app never tries to write into its own read-only installation directory
        // (e.g. C:\Program Files\WhatsFlow) which would cause EPERM / SQLITE_READONLY.
        process.env.WHATSFLOW_USER_DATA = app.getPath('userData');

        // Auto-enable tunnel with a stable, per-installation subdomain
        if (!process.env.ENABLE_TUNNEL) {
            process.env.ENABLE_TUNNEL = 'true';
        }
        if (!process.env.TUNNEL_SUBDOMAIN) {
            // app.getPath('userData') is available before app.whenReady() on Electron 36+
            process.env.TUNNEL_SUBDOMAIN = getStableSubdomain();
        }

        require('../backend/server');
    } catch (e) {
        console.error('Failed to start backend:', e);
    }
}

/**
 * @function waitForBackend
 * @description Polls the /health endpoint every 500 ms until a 200 response
 *              is received or the timeout elapses. Used to delay window creation
 *              until the Express server is fully initialised.
 * @param {number} port - Port on which the backend is listening.
 * @param {number} [timeoutMs=30000] - Maximum wait time in milliseconds.
 * @returns {Promise<void>} Resolves on success, rejects on timeout.
 */
function waitForBackend(port, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        function check() {
            const req = http.get(`http://localhost:${port}/health`, (res) => {
                if (res.statusCode === 200) return resolve();
                retry();
            });
            req.on('error', retry);
            req.setTimeout(2000, retry);
        }

        function retry() {
            if (Date.now() - start > timeoutMs) {
                return reject(new Error('Backend did not start within timeout'));
            }
            setTimeout(check, 500);
        }

        check();
    });
}

/**
 * @function createWindow
 * @description Creates the main BrowserWindow with security-hardened webPreferences
 *              (no nodeIntegration, contextIsolation, sandbox). Loads Vite dev server
 *              in development and the Express-served frontend in production.
 * @returns {BrowserWindow} The created browser window instance.
 */
function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'WhatsFlow',
        icon: path.join(__dirname, '../frontend/public/icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadURL('http://localhost:3000');
    }

    return win;
}

app.whenReady().then(async () => {
    app.setName('WhatsFlow');

    if (!isDev) {
        try {
            const port = process.env.PORT || 3000;
            await waitForBackend(port);
        } catch (err) {
            console.error('Backend startup failed:', err.message);
        }
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Graceful shutdown: close DB and stop worker before quitting
app.on('before-quit', () => {
    try {
        const { stopWorker } = require('../backend/worker');
        stopWorker();
    } catch (e) { /* ignore if not loaded */ }

    try {
        const db = require('../backend/database');
        if (db.dbWriter) {
            db.dbWriter.close((err) => {
                if (err) console.error('Error closing writer database:', err);
            });
        }
        db.close((err) => {
            if (err) console.error('Error closing database:', err);
        });
    } catch (e) { /* ignore if not loaded */ }
});
