const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// In production, we run the backend server inside the main process
// to avoid needing a separate Node executable.
if (!isDev) {
    try {
        console.log('Starting internal backend server...');
        require('../backend/server');
    } catch (e) {
        console.error('Failed to start backend:', e);
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "WhatsFlow",
        icon: path.join(__dirname, '../frontend/public/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (isDev) {
        // In dev, we wait for Vite (5173) and Express (3000)
        // package.json handles the waiting via 'wait-on'
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        // In production, serve from Express
        win.loadURL('http://localhost:3000');
    }
}

app.whenReady().then(() => {
    if (!isDev) {
        // In production, wait for backend to initialize DB and release locks
        // This prevents the "native crash" caused by race conditions
        console.log('Waiting 3 seconds for backend server to start...');
        setTimeout(createWindow, 3000);
    } else {
        createWindow();
    }

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
