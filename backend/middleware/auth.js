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
const API_KEY = crypto.randomBytes(32).toString('hex');

// Rate-limit state for token endpoint (defence-in-depth Layer 3).
// Layers 1 (proxy detection) and 2 (loopback IP) already block all remote attacks.
// This rate limit guards against a theoretical rogue local process attempting rapid
// automated probing, while still allowing legitimate page refreshes (Ctrl+R, HMR,
// and browser navigation) at any time after server start.
// The previous single-use-with-grace-window approach was too aggressive: it locked
// the user out permanently after the 15-second grace window, requiring a full app
// restart on any page refresh or HMR reload.
const ISSUE_MAX_PER_MINUTE = 10;
let issueCount = 0;
let issueWindowStart = Date.now();

/**
 * @function apiAuth
 * @description Express middleware that enforces API key authentication.
 *              Uses constant-time comparison to prevent timing side-channel attacks.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
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
 *
 *   Security layers applied (in order):
 *   1. Proxy / tunnel detection — any request that arrived via a proxy
 *      (LocalTunnel, nginx, ngrok, etc.) carries an X-Forwarded-For header.
 *      Direct Electron TCP connections never set this header. Reject anything
 *      that has it so an external attacker cannot use the public tunnel URL to
 *      obtain the key.
 *   2. Loopback IP guard — req.ip must be 127.0.0.1 / ::1.
 *   3. Rate limiting — up to 10 requests per 60-second window. This is a
 *      defence-in-depth measure against a theoretical rogue local process;
 *      it does not prevent legitimate page reloads (Ctrl+R, HMR).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function issueToken(req, res) {
    // --- Layer 1: Proxy / tunnel detection ---
    // LocalTunnel (and every other proxy) injects X-Forwarded-For.
    // A direct Electron connection has no such header.
    if (req.headers['x-forwarded-for']) {
        logger.warn('Token request blocked — proxy/tunnel header detected (X-Forwarded-For present)');
        return res.status(403).json({ error: 'Forbidden' });
    }

    // --- Layer 2: Loopback IP guard ---
    const ip = req.ip || req.connection.remoteAddress;
    const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    if (!isLocal) {
        logger.warn(`Non-local token request from ${ip}`);
        return res.status(403).json({ error: 'Forbidden' });
    }

    // --- Layer 3: Rate limiting (defence-in-depth) ---
    // Layers 1+2 already block all remote and proxied requests. This rate limit
    // caps automated probing from a hypothetical rogue local process while still
    // allowing legitimate page reloads (Ctrl+R, Vite HMR) at any point in the
    // session — not just during the first 15 seconds.
    const now = Date.now();
    if (now - issueWindowStart > 60000) {
        issueWindowStart = now;
        issueCount = 0;
    }
    issueCount++;
    if (issueCount > ISSUE_MAX_PER_MINUTE) {
        logger.warn('Token rate limit exceeded — too many requests in 60s window');
        return res.status(429).json({ error: 'Too Many Requests' });
    }

    logger.info('API key issued to local renderer');
    res.json({ apiKey: API_KEY });
}

module.exports = { apiAuth, issueToken, getApiKey: () => API_KEY };
