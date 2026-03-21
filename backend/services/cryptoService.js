/**
 * @file cryptoService.js
 * @description Credential encryption and decryption service.
 *              Uses Electron safeStorage (OS-level keychain) in production.
 *              Falls back to Base64 encoding in development only — never in production.
 * @module backend/services/cryptoService
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

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
    process.stderr.write('[CryptoService] Electron safeStorage not available. Using development mode encryption.\n');
}

module.exports = {
    /**
     * @function encrypt
     * @description Encrypts a plain-text string using Electron safeStorage in
     *              production, or Base64 in development.
     * @param {string} plainText - The value to encrypt.
     * @returns {string} Encrypted cipher string (base64-encoded buffer or DEV_ENC prefix).
     * @throws {Error} If called in production without Electron safeStorage available.
     */
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

    /**
     * @function decrypt
     * @description Decrypts a cipher string previously produced by encrypt().
     *              Handles both DEV_ENC (Base64) and production (safeStorage) formats.
     * @param {string} cipherText - The encrypted value from the database.
     * @returns {string} The original plain-text value, or '' on failure.
     * @throws {Error} If DEV_ENC data is encountered in production mode.
     */
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
