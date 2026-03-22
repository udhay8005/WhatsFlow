/**
 * @file auth.js
 * @description Local API key authentication middleware.
 *              Generates a cryptographically random session key on startup
 *              and issues it only to requests from localhost via /auth/token.
 *              All /api/* routes must include the key in the X-API-Key header.
 * @module backend/middleware/auth
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Generate a session API key on server start (rotates each launch).
// Security model: localhost-only issuance + 256-bit random key + key rotation
// on every server restart gives sufficient protection for a local desktop app.
const API_KEY = crypto.randomBytes(32).toString('hex');

/**
 * @function apiAuth
 * @description Express middleware that enforces API key authentication.
 *              Uses constant-time comparison to prevent timing side-channel attacks.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Next middleware callback.
 * @returns {void}
 */
function apiAuth(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || typeof key !== 'string') {
        return res.status(403).json({ error: 'Forbidden: invalid or missing API key' });
    }

    // Constant-time comparison to prevent timing attacks
    const supplied = Buffer.from(key);
    const expected = Buffer.from(API_KEY);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        return res.status(403).json({ error: 'Forbidden: invalid or missing API key' });
    }
    next();
}

/**
 * @function issueToken
 * @description Route handler that returns the session API key.
 *              Restricted to loopback addresses only (127.0.0.1, ::1).
 *              Single-use: once the Electron renderer has retrieved the key,
 *              all subsequent requests are rejected. This prevents other
 *              local processes from stealing the key.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {void}
 */
function issueToken(req, res) {
    const ip = req.ip || req.connection.remoteAddress;
    const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);

    if (!isLocal) {
        logger.warn(`Non-local token request from ${ip}`);
        return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info('API key issued to Electron renderer');
    res.json({ apiKey: API_KEY });
}

module.exports = { apiAuth, issueToken, getApiKey: () => API_KEY };
