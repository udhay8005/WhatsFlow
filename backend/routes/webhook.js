/**
 * @file webhook.js
 * @description Meta WhatsApp Business webhook handler.
 *              Implements the GET verification handshake (hub.mode / hub.verify_token)
 *              and the POST event listener with mandatory HMAC SHA-256 signature
 *              validation. Updates message delivery statuses in the database and
 *              emits real-time Socket.IO events to the frontend.
 * @module backend/routes/webhook
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Enforce size limit for webhook payloads.
// The verify callback captures the raw request bytes so we can
// validate the X-Hub-Signature-256 header using the exact bytes
// that Meta signed — NOT a re-serialised JSON string.
router.use(express.json({
    limit: '100kb',
    verify: (req, _res, buf) => { req.rawBody = buf; }
}));
const db = require('../database');
const cryptoService = require('../services/cryptoService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @function getVerifyToken
 * @description Loads and decrypts the webhook_verify_token from app_config.
 *              Returns null if not yet configured — the GET handler will reject
 *              the verification request with a 403.
 * @returns {Promise<string|null>} Decrypted verify token, or null.
 */
async function getVerifyToken() {
    return new Promise((resolve) => {
        db.get("SELECT value FROM app_config WHERE key = 'webhook_verify_token'", (err, row) => {
            if (row) resolve(cryptoService.decrypt(row.value));
            else resolve(null); // Must be configured via Settings
        });
    });
}

/**
 * @function getAppSecret
 * @description Loads and decrypts the wa_app_secret from app_config.
 *              Used to validate the X-Hub-Signature-256 header on incoming POST events.
 * @returns {Promise<string|null>} Decrypted app secret, or null if not configured.
 */
async function getAppSecret() {
    return new Promise((resolve) => {
        db.get("SELECT value FROM app_config WHERE key = 'wa_app_secret'", (err, row) => {
            if (row) resolve(cryptoService.decrypt(row.value));
            else resolve(null);
        });
    });
}

// 1. Verification Endpoint (GET)
router.get('/', asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        const configuredToken = await getVerifyToken();

        if (!configuredToken) {
            logger.error('Webhook verify token not configured — rejecting verification');
            return res.sendStatus(403);
        }

        if (mode === 'subscribe' && token === configuredToken) {
            logger.info('Webhook verified');
            res.status(200).send(challenge);
        } else {
            logger.warn('Webhook verification failed - token mismatch');
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
}));

// 2. Event Listener (POST) with Signature Validation
router.post('/', asyncHandler(async (req, res) => {
    // Webhook signature validation (HMAC SHA-256)
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = await getAppSecret();

    if (appSecret) {
        // req.rawBody is populated by the verify callback in the local express.json()
        // registered at the top of this router.  If it is absent it means another
        // middleware has already consumed the stream — we CANNOT reconstruct the
        // exact bytes Meta signed (JSON.stringify may change whitespace/key order),
        // so we reject rather than risk an HMAC false-positive or false-negative.
        if (!req.rawBody) {
            logger.error('Webhook raw body unavailable — body parser conflict. Rejecting request.');
            return res.sendStatus(400);
        }
        const rawBody = req.rawBody;

        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', appSecret)
            .update(rawBody)
            .digest('hex');

        const source = Buffer.from(signature || '');
        const target = Buffer.from(expectedSignature);

        // Constant-time comparison to prevent timing attacks
        if (source.length !== target.length || !crypto.timingSafeEqual(source, target)) {
            logger.warn('Webhook signature validation failed - rejecting request');
            return res.sendStatus(403);
        }
    } else {
        logger.error('No app secret configured — rejecting webhook. Configure wa_app_secret in Settings.');
        return res.sendStatus(403);
    }

    const body = req.body;

    // Log webhook event type only (redact sensitive data for privacy)
    const eventType = body.object || 'unknown';
    const entryCount = body.entry?.length || 0;
    logger.info(`Webhook received: ${eventType}, entries: ${entryCount}`);

    const io = req.app.get('io');

    if (body.object === 'whatsapp_business_account') {
        if (body.entry) {
            body.entry.forEach(entry => {
                const changes = entry.changes;
                if (changes) {
                    changes.forEach(change => {
                        if (change.value && change.value.statuses) {
                            change.value.statuses.forEach(status => {
                                const wamid = status.id;
                                const newStatus = status.status;
                                // Parse Meta error reason if present (failed status)
                                const errorReason = status.errors?.[0]
                                    ? `[${status.errors[0].code}] ${status.errors[0].title}`
                                    : null;

                                logger.info(`Message status update: ${newStatus}${errorReason ? ' — ' + errorReason : ''}`);

                                const sql = errorReason
                                    ? `UPDATE messages SET status = ?, error_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_message_id = ?`
                                    : `UPDATE messages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_message_id = ?`;
                                const params = errorReason ? [newStatus, errorReason, wamid] : [newStatus, wamid];

                                db.run(sql, params, (err) => {
                                    if (!err) {
                                        io.emit('status_update', { id: wamid, status: newStatus });
                                    }
                                });
                            });
                        }
                    });
                }
            });
        }
        res.sendStatus(200);
    } else {
        // Always return 200 — Meta retries on any non-200 response
        logger.info(`Unrecognised webhook object type: ${body.object}`);
        res.sendStatus(200);
    }
}));

module.exports = router;
