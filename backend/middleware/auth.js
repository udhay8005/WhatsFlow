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

// Generate a session API key on server start (rotates each launch)
const API_KEY = crypto.randomBytes(32).toString('hex');
let keyIssued = false;

/**
 * @function apiAuth
 * @description Express middleware that enforces API key authentication.
 *              Rejects requests that do not carry a valid X-API-Key header.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Next middleware callback.
 * @returns {void}
 */
function apiAuth(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(403).json({ error: 'Forbidden: invalid or missing API key' });
    }
    next();
}

/**
 * @function issueToken
 * @description Route handler that returns the session API key.
 *              Restricted to loopback addresses only (127.0.0.1, ::1).
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

    keyIssued = true;
    res.json({ apiKey: API_KEY });
}

module.exports = { apiAuth, issueToken, getApiKey: () => API_KEY };
