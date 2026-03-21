const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose functionality if needed, though mostly we use HTTP to localhost
    getAppVersion: () => process.versions.app
});
