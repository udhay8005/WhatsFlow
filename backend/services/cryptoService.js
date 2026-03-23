/**
 * @file cryptoService.js
 * @description Credential encryption and decryption service.
 *
 *              Encryption priority:
 *                1. Electron safeStorage (OS-level DPAPI/Keychain) — used when the
 *                   backend runs inside the Electron main process.
 *                2. AES-256-GCM with a per-installation random key stored in the
 *                   application's userData directory (`encryption.key`). Used when
 *                   safeStorage is unavailable (development server, headless CI, or
 *                   disrupted DPAPI state). Provides real cryptographic security
 *                   unlike the previous Base64 "DEV_ENC" fallback.
 *
 *              Legacy DEV_ENC (Base64) values found in development databases are
 *              still decoded on read so existing dev environments continue to work,
 *              but all new writes use AES-256-GCM.
 *
 * @module backend/services/cryptoService
 * @author Udhaya Chandra SA
 * @version 1.0.2
 */

const nodeCrypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// ─── Electron safeStorage (primary) ──────────────────────────────────────────
let safeStorage = null;
try {
    // Works when backend/server.js is require()'d inside the Electron main process.
    // Fails (and is caught) when running as a plain Node.js server in development.
    const electron = require('electron');
    safeStorage = electron.safeStorage;
} catch (_) {
    process.stderr.write('[CryptoService] Electron safeStorage not available — using AES-256-GCM fallback.\n');
}

// ─── AES-256-GCM fallback ────────────────────────────────────────────────────
// Cipher text format: AES_ENC:<iv_hex(24)>:<authTag_hex(32)>:<ciphertext_b64>
const AES_ENC_PREFIX = 'AES_ENC:';
let _aesKey = null; // cached in memory after first load

/**
 * @function getAesKey
 * @description Returns the 256-bit AES key for the local installation.
 *              On first call the key is generated via crypto.randomBytes(32) and
 *              persisted to `encryption.key` in the app userData directory.
 *              Subsequent calls reload the same key from disk.
 * @returns {Buffer|null} 32-byte key Buffer, or null if the key file cannot be
 *                        created (unlikely but handled gracefully).
 */
function getAesKey() {
    if (_aesKey) return _aesKey;
    // Production: WHATSFLOW_USER_DATA = app.getPath('userData'), set by Electron main.
    // Development: fall back to project root so dev builds still function.
    const keyDir = process.env.WHATSFLOW_USER_DATA || path.resolve(__dirname, '../..');
    const keyPath = path.join(keyDir, 'encryption.key');
    try {
        if (fs.existsSync(keyPath)) {
            const hex = fs.readFileSync(keyPath, 'utf8').trim();
            const key = Buffer.from(hex, 'hex');
            // Validate key length — a partial write (power loss, disk full) could
            // leave a 0-byte or truncated file.  Delete and regenerate rather than
            // throwing "Invalid key length" from createCipheriv which would brick
            // the settings page until the user manually removes the file.
            if (key.length !== 32) {
                logger.warn('[CryptoService] Corrupted encryption.key (' + key.length +
                    ' bytes, expected 32). Deleting and regenerating.');
                fs.unlinkSync(keyPath);
                // fall through to generation below
            } else {
                _aesKey = key;
                return _aesKey;
            }
        }
        // Generate new key and write atomically: write to a .tmp file first,
        // then rename.  On NTFS and most POSIX filesystems rename is atomic,
        // so the key file is either fully written or absent — never a partial.
        _aesKey = nodeCrypto.randomBytes(32);
        fs.mkdirSync(keyDir, { recursive: true });
        const tmpPath = keyPath + '.tmp';
        fs.writeFileSync(tmpPath, _aesKey.toString('hex'), 'utf8');
        fs.renameSync(tmpPath, keyPath);
        logger.info('[CryptoService] Generated new AES-256 installation key: ' + keyPath);
        return _aesKey;
    } catch (e) {
        logger.error('[CryptoService] Failed to load/create AES key:', e.message);
        return null;
    }
}

/**
 * @function aesEncrypt
 * @description Encrypts `text` with AES-256-GCM using the installation key.
 *              A random 96-bit IV is generated per call; the authentication tag
 *              is embedded in the output so tampering is detected on decrypt.
 * @param {string} text - Plain-text value to encrypt.
 * @returns {string} `AES_ENC:<iv_hex>:<authTag_hex>:<ciphertext_base64>`
 * @throws {Error} If the AES key cannot be loaded.
 */
function aesEncrypt(text) {
    const key = getAesKey();
    if (!key) throw new Error('AES encryption key unavailable — cannot persist credentials securely.');
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return AES_ENC_PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('base64');
}

/**
 * @function aesDecrypt
 * @description Decrypts a string produced by aesEncrypt(). The GCM auth tag
 *              verification ensures integrity — any tampering causes a throw.
 * @param {string} value - Encrypted string starting with `AES_ENC:` prefix.
 * @returns {string} Original plain-text value.
 * @throws {Error} If the key is unavailable, the string is malformed, or the
 *                 authentication tag check fails (data tampered).
 */
function aesDecrypt(value) {
    const key = getAesKey();
    if (!key) throw new Error('AES decryption key unavailable.');
    const payload = value.slice(AES_ENC_PREFIX.length);
    const [ivHex, tagHex, cipherB64] = payload.split(':');
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(cipherB64, 'base64')),
        decipher.final()
    ]).toString('utf8');
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {
    /**
     * @function encrypt
     * @description Encrypts a plain-text string. Tries Electron safeStorage first;
     *              falls back to AES-256-GCM with the local installation key.
     * @param {string} plainText - The value to encrypt.
     * @returns {string} Encrypted cipher string.
     * @throws {Error} If no encryption mechanism is available (key file I/O failure).
     */
    encrypt: (plainText) => {
        if (!plainText) return '';

        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            return safeStorage.encryptString(plainText).toString('base64');
        }

        // AES-256-GCM fallback — cryptographically secure on all platforms without
        // requiring an OS keychain. Replaces the previous Base64 DEV_ENC fallback
        // which provided zero security (plain base64 is trivially reversible).
        return aesEncrypt(plainText);
    },

    /**
     * @function decrypt
     * @description Decrypts a cipher string previously produced by encrypt().
     *              Recognises three formats for backward compatibility:
     *              - `AES_ENC:…`   → AES-256-GCM (current)
     *              - `DEV_ENC:…`   → legacy Base64 (development only — read-only migration path)
     *              - raw base64    → Electron safeStorage (production original format)
     * @param {string} cipherText - The encrypted value from the database.
     * @returns {string} The original plain-text value, or '' on failure.
     */
    decrypt: (cipherText) => {
        if (!cipherText) return '';

        // ── AES-256-GCM (current fallback format) ──────────────────────────────
        if (cipherText.startsWith(AES_ENC_PREFIX)) {
            try {
                return aesDecrypt(cipherText);
            } catch (e) {
                logger.error('[CryptoService] AES decryption failed:', e.message);
                return '';
            }
        }

        // ── Legacy DEV_ENC Base64 (migration read path) ─────────────────────────
        // Only accepted in development so old dev databases keep working.
        // New writes always use AES-256-GCM, so this format will naturally phase out.
        if (cipherText.startsWith('DEV_ENC:')) {
            if (process.env.NODE_ENV === 'production') {
                logger.error('[CryptoService] Legacy DEV_ENC credential found in production. ' +
                    'Re-enter your settings to re-encrypt with AES-256-GCM.');
                return '';
            }
            return Buffer.from(cipherText.replace('DEV_ENC:', ''), 'base64').toString('utf8');
        }

        // ── Electron safeStorage (production original format — raw base64 buffer) ─
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            try {
                return safeStorage.decryptString(Buffer.from(cipherText, 'base64'));
            } catch (e) {
                logger.error('[CryptoService] safeStorage decryption failed:', e.message);
                return '';
            }
        }

        // Cannot decrypt — log clearly so the user knows to re-enter their settings.
        logger.error('[CryptoService] Cannot decrypt value — safeStorage unavailable and ' +
            'format not recognised. Re-enter your settings to re-encrypt.');
        return '';
    }
};
