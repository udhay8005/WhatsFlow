/**
 * @file preload.js
 * @description Electron preload script. Runs in the renderer process with a
 *              limited Node.js context. Exposes a safe, minimal API surface to
 *              the renderer via contextBridge to avoid direct Node.js access.
 * @module electron/preload
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose functionality if needed, though mostly we use HTTP to localhost
    getAppVersion: () => process.versions.app
});
