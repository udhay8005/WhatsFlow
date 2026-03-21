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

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// In production, run the backend server inside the main process
if (!isDev) {
    try {
        process.env.NODE_ENV = 'production'; // Ensure server starts and serves static files
        console.log('Starting internal backend server...');
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
        icon: path.join(__dirname, '../frontend/dist/logo.png'),
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
            console.log('Waiting for backend server to be ready...');
            await waitForBackend(port);
            console.log('Backend is ready.');
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
        db.close((err) => {
            if (err) console.error('Error closing database:', err);
        });
    } catch (e) { /* ignore if not loaded */ }
});
