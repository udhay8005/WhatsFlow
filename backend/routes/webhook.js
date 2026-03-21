const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Enforce size limit for webhook payloads
router.use(express.json({ limit: '100kb' }));
const db = require('../database');
const cryptoService = require('../services/cryptoService');
const logger = require('../utils/logger');

// Helper to get verify token
async function getVerifyToken() {
    return new Promise((resolve) => {
        db.get("SELECT value FROM app_config WHERE key = 'webhook_verify_token'", (err, row) => {
            if (row) resolve(cryptoService.decrypt(row.value));
            else resolve('whatsflow_secret'); // Fallback
        });
    });
}

// Helper to get app secret for signature validation
async function getAppSecret() {
    return new Promise((resolve) => {
        db.get("SELECT value FROM app_config WHERE key = 'wa_app_secret'", (err, row) => {
            if (row) resolve(cryptoService.decrypt(row.value));
            else resolve(null);
        });
    });
}

// 1. Verification Endpoint (GET)
router.get('/', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        const configuredToken = await getVerifyToken();

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
});

// 2. Event Listener (POST) with Signature Validation
router.post('/', async (req, res) => {
    // Webhook signature validation (HMAC SHA-256)
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = await getAppSecret();

    if (appSecret) {
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', appSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        const source = Buffer.from(signature || '');
        const target = Buffer.from(expectedSignature);

        // Constant-time comparison to prevent timing attacks
        if (source.length !== target.length || !crypto.timingSafeEqual(source, target)) {
            logger.warn('Webhook signature validation failed - rejecting request');
            return res.sendStatus(403);
        }
    } else if (process.env.NODE_ENV === 'production') {
        logger.error('CRITICAL: No app secret configured in production - rejecting webhook');
        return res.sendStatus(403);
    } else {
        logger.warn('No app secret configured - signature validation skipped (DEV only)');
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
                                // Status Update: sent, delivered, read, failed
                                const wamid = status.id;
                                const newStatus = status.status;
                                const timestamp = status.timestamp;

                                logger.info(`Message status update: ${newStatus}`);

                                // Update DB
                                db.run(`UPDATE messages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_message_id = ?`,
                                    [newStatus, wamid], (err) => {
                                        if (!err) {
                                            // Emit to UI
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
        res.sendStatus(404);
    }
});

module.exports = router;
