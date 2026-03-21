const logger = require('../utils/logger');
let safeStorage = null;

try {
    // Try to load Electron's safeStorage
    // This will work if 'backend/server.js' is require()'d inside Electron Main process.
    // It will FAIL if run via 'node backend/server.js'
    const electron = require('electron');
    safeStorage = electron.safeStorage;
} catch (error) {
    // Standard Node.js environment (Development mode only)
    console.warn('[CryptoService] Electron safeStorage not available. Using development mode encryption.');
}

module.exports = {
    encrypt: (plainText) => {
        if (!plainText) return '';

        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            return safeStorage.encryptString(plainText).toString('base64');
        } else {
            // Development fallback (NOT for production)
            if (process.env.NODE_ENV === 'production') {
                throw new Error('CRITICAL: Encryption not available in production mode. Ensure Electron safeStorage is accessible.');
            }
            return 'DEV_ENC:' + Buffer.from(plainText).toString('base64');
        }
    },

    decrypt: (cipherText) => {
        if (!cipherText) return '';

        if (cipherText.startsWith('DEV_ENC:')) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('CRITICAL: Development encryption detected in production mode.');
            }
            const base64 = cipherText.replace('DEV_ENC:', '');
            return Buffer.from(base64, 'base64').toString('utf8');
        }

        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            try {
                return safeStorage.decryptString(Buffer.from(cipherText, 'base64'));
            } catch (e) {
                logger.error('Decryption failed:', e);
                return '';
            }
        }

        return ''; // Cannot decrypt
    }
};
