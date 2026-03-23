/**
 * @file settings.js
 * @description Application settings REST API routes.
 *              Manages WhatsApp credentials, SMTP configuration, and operational
 *              settings. All credential values are encrypted before storage via
 *              cryptoService. Includes SMTP connection testing, tunnel status,
 *              history/log clearing, and database optimisation endpoints.
 * @module backend/routes/settings
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const cryptoService = require('../services/cryptoService');
const { validateSettings } = require('../middleware/validators');
const { getTunnelUrl, isTunnelActive } = require('../tunnelManager');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// Strict limit for settings updates (5 attempts per minute)
const settingsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many settings updates, please try again later' }
});

// GET /api/settings/config
// Returns masked status of credentials
router.get('/config', (req, res) => {
    const keysToCheck = [
        'wa_access_token', 'wa_phone_id', 'wa_waba_id',
        'wa_app_secret', 'webhook_verify_token',
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
        'smtp_from_email', 'smtp_from_name', 'email_fallback_subject', 'max_tps'
    ];
    const status = {};

    // Use parameterized query to prevent SQL injection
    const placeholders = keysToCheck.map(() => '?').join(',');
    db.all(`SELECT key, value FROM app_config WHERE key IN (${placeholders})`, keysToCheck, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const existingKeys = new Set(rows.map(r => r.key));
        keysToCheck.forEach(key => {
            status[key] = existingKeys.has(key);
        });

        // Return actual (decrypted) values for non-secret settings
        const plainValueKeys = {
            max_tps: '5',
            smtp_from_email: '',
            smtp_from_name: '',
            email_fallback_subject: ''
        };
        Object.entries(plainValueKeys).forEach(([key, defaultVal]) => {
            const row = rows.find(r => r.key === key);
            status[key] = row ? cryptoService.decrypt(row.value) : defaultVal;
        });

        res.json({ configured: status });
    });
});

// POST /api/settings/config
// Saves encrypted credentials
router.post('/config', validateSettings, (req, res) => {
    const allowedKeys = [
        'wa_access_token',
        'wa_phone_id',
        'wa_waba_id',
        'wa_app_secret',
        'webhook_verify_token',
        'smtp_host',
        'smtp_port',
        'smtp_user',
        'smtp_pass',
        'smtp_secure',
        'smtp_from_email',
        'smtp_from_name',
        'email_fallback_subject',
        'max_tps'
    ];

    const updates = {};
    allowedKeys.forEach(key => {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid settings provided to update." });
    }

    // ── Phase 1: Encrypt all values BEFORE touching the database. ──────────
    // cryptoService.encrypt() may throw (e.g. AES key unavailable). If this
    // happened inside db.serialize(), the exception would escape the callback
    // after BEGIN TRANSACTION was queued but before COMMIT, leaving the
    // transaction permanently open and locking the database.
    const encryptedEntries = [];
    try {
        for (const [key, val] of Object.entries(updates)) {
            if (val === null || val === '') {
                encryptedEntries.push({ key, encrypted: null }); // marks for DELETE
            } else {
                encryptedEntries.push({ key, encrypted: cryptoService.encrypt(String(val)) });
            }
        }
    } catch (encErr) {
        return res.status(500).json({ error: 'Encryption failed: ' + encErr.message });
    }

    // ── Phase 2: Write pre-encrypted values inside a transaction. ────────
    // Every stmt.run() receives an error callback so failures are captured
    // rather than silently swallowed (sqlite3 discards errors from runs
    // without callbacks). The COMMIT callback aggregates any write errors.
    const stmtUpsert = db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)");
    const stmtDelete = db.prepare("DELETE FROM app_config WHERE key = ?");
    const writeErrors = [];

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        for (const entry of encryptedEntries) {
            if (entry.encrypted === null) {
                stmtDelete.run(entry.key, (err) => {
                    if (err) writeErrors.push(err.message);
                });
            } else {
                stmtUpsert.run(entry.key, entry.encrypted, (err) => {
                    if (err) writeErrors.push(err.message);
                });
            }
        }

        db.run("COMMIT", (commitErr) => {
            stmtUpsert.finalize();
            stmtDelete.finalize();
            if (commitErr || writeErrors.length > 0) {
                const msg = commitErr ? commitErr.message : writeErrors.join('; ');
                return res.status(500).json({ error: 'Database write failed: ' + msg });
            }
            res.json({ success: true, message: "Settings saved securely." });
        });
    });
});

// POST /api/settings/test-smtp
// Test SMTP connection with provided credentials
router.post('/test-smtp', asyncHandler(async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure } = req.body;

    if (!smtp_host || !smtp_user || !smtp_pass) {
        return res.status(400).json({ error: 'Missing required SMTP fields' });
    }

    const nodemailer = require('nodemailer');

    try {
        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port) || 587,
            secure: smtp_secure === 'true',
            auth: {
                user: smtp_user,
                pass: smtp_pass,
            },
        });

        // Verify connection
        await transporter.verify();

        res.json({ success: true, message: 'SMTP connection successful!' });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'SMTP connection failed: ' + error.message
        });
    }
}));

// GET /api/settings/tunnel
// Returns current tunnel status + saved subdomain from db (or env fallback)
router.get('/tunnel', (req, res) => {
    const url = getTunnelUrl();
    const active = isTunnelActive();

    // Read saved subdomain from database, fall back to env var
    db.get('SELECT value FROM app_config WHERE key = ?', ['tunnel_subdomain'], (err, row) => {
        const savedSubdomain = row?.value || process.env.TUNNEL_SUBDOMAIN || null;
        const expectedUrl = savedSubdomain ? `https://${savedSubdomain}.loca.lt/webhook` : null;

        res.json({
            active,
            url: url ? `${url}/webhook` : (active ? null : expectedUrl),
            baseUrl: url || null,
            subdomain: savedSubdomain,
            savedSubdomain,
            connecting: !active && !!savedSubdomain
        });
    });
});

// POST /api/settings/tunnel/start
// Starts the LocalTunnel at runtime (no server restart needed).
// Subdomain priority: request body → database → env var → random
router.post('/tunnel/start', asyncHandler(async (req, res) => {
    try {
        const { startTunnel, isTunnelActive } = require('../tunnelManager');
        if (isTunnelActive()) {
            const { getTunnelUrl } = require('../tunnelManager');
            return res.json({ success: true, url: getTunnelUrl() + '/webhook', message: 'Tunnel already running' });
        }
        const PORT = process.env.PORT || 3000;
        const reqSubdomain = (req.body?.subdomain || '').trim() || null;

        // Resolve final subdomain: body → db → env
        const resolveSubdomain = () => new Promise((resolve) => {
            if (reqSubdomain) return resolve(reqSubdomain);
            db.get('SELECT value FROM app_config WHERE key = ?', ['tunnel_subdomain'], (err, row) => {
                resolve(row?.value || process.env.TUNNEL_SUBDOMAIN || undefined);
            });
        });

        const subdomain = await resolveSubdomain();

        // Persist chosen subdomain so the UI shows it on next load
        if (subdomain) {
            db.run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['tunnel_subdomain', subdomain]);
        }

        const url = await startTunnel(PORT, subdomain);
        logger.info('Tunnel started via API: ' + url + ' (subdomain: ' + (subdomain || 'random') + ')');
        res.json({ success: true, url: url + '/webhook', subdomain: subdomain || null, message: 'Tunnel started successfully' });
    } catch (error) {
        logger.error('Failed to start tunnel via API:', error.message);
        res.status(500).json({ success: false, error: 'Failed to start tunnel: ' + error.message });
    }
}));

// POST /api/settings/tunnel/stop
// Stops the active LocalTunnel
router.post('/tunnel/stop', asyncHandler(async (req, res) => {
    try {
        const { stopTunnel } = require('../tunnelManager');
        await stopTunnel();
        logger.info('Tunnel stopped via API');
        res.json({ success: true, message: 'Tunnel stopped' });
    } catch (error) {
        logger.error('Failed to stop tunnel via API:', error.message);
        res.status(500).json({ success: false, error: 'Failed to stop tunnel: ' + error.message });
    }
}));

// POST /api/settings/clear-history
// Deletes all campaigns and messages
router.post('/clear-history', (req, res) => {
    // Guard helper: only send a response if headers haven't been sent yet,
    // preventing "Cannot set headers after they are sent" crashes if an
    // async db callback fires after a synchronous catch already responded.
    const safeSend = (fn) => { if (!res.headersSent) fn(); };

    try {
        db.serialize(() => {
            db.run('DELETE FROM messages', (err) => {
                if (err) {
                    return safeSend(() => res.status(500).json({ error: 'Failed to clear messages: ' + err.message }));
                }

                db.run('DELETE FROM campaigns', (err) => {
                    if (err) {
                        return safeSend(() => res.status(500).json({ error: 'Failed to clear campaigns: ' + err.message }));
                    }

                    safeSend(() => res.json({
                        success: true,
                        message: 'All campaign and message history cleared successfully'
                    }));
                });
            });
        });
    } catch (error) {
        return safeSend(() => res.status(500).json({ error: 'Failed to clear history: ' + error.message }));
    }
});

// POST /api/settings/clear-logs
// Clears log files (if logging to files is implemented)
router.post('/clear-logs', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        // Mirror the same directory resolution used by logger.js so both modules
        // always operate on the same physical folder (AppData/logs in production,
        // backend/logs in development). The previous path.join(__dirname, '../../backend/logs')
        // was structurally brittle — it worked by accident and breaks if the directory is renamed.
        const logsDir = process.env.WHATSFLOW_USER_DATA
            ? path.join(process.env.WHATSFLOW_USER_DATA, 'logs')
            : path.join(__dirname, '../logs');

        // Check if logs directory exists
        if (fs.existsSync(logsDir)) {
            const files = fs.readdirSync(logsDir);
            let cleared = 0;

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    // Truncate instead of delete — Winston holds log files open in
                    // append mode while the server is running. On Windows, open files
                    // are exclusively locked and fs.unlinkSync() throws EBUSY/EPERM.
                    // Writing an empty string clears the content without touching the
                    // file handle, which is safe on all platforms.
                    fs.writeFileSync(path.join(logsDir, file), '');
                    cleared++;
                }
            });

            res.json({
                success: true,
                message: `Cleared ${cleared} log file(s)`
            });
        } else {
            res.json({
                success: true,
                message: 'No log files found'
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear logs: ' + error.message });
    }
});

// POST /api/settings/clean-app
// Comprehensive cleanup: logs, temp files, optimize database
router.post('/clean-app', (req, res) => {
    const safeSend = (fn) => { if (!res.headersSent) fn(); };

    try {
        const fs = require('fs');
        const path = require('path');
        let actions = [];

        // 1. Clear logs — truncate, not delete (Winston holds files open on Windows)
        const logsDir = process.env.WHATSFLOW_USER_DATA
            ? path.join(process.env.WHATSFLOW_USER_DATA, 'logs')
            : path.join(__dirname, '../logs');
        if (fs.existsSync(logsDir)) {
            const files = fs.readdirSync(logsDir);
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    fs.writeFileSync(path.join(logsDir, file), '');
                }
            });
            actions.push('Cleared log files');
        }

        // 2. Remove temp upload files older than 24 hours
        const uploadsDir = process.env.WHATSFLOW_UPLOADS_DIR || path.join(__dirname, '../uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                const hoursSinceModified = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
                if (hoursSinceModified > 24) {
                    fs.unlinkSync(filePath);
                }
            });
            actions.push('Cleaned old uploaded files');
        }

        // 3. Optimize database (VACUUM) — async; respond from callback only
        db.run('VACUUM', (err) => {
            if (err) {
                logger.error('Failed to optimize database:', err);
            } else {
                actions.push('Optimized database');
            }

            safeSend(() => res.json({
                success: true,
                message: `App cleaned: ${actions.join(', ')}`
            }));
        });

    } catch (error) {
        // Synchronous fs error (e.g. permission denied) — db.run not yet queued
        return safeSend(() => res.status(500).json({ error: 'Failed to clean app: ' + error.message }));
    }
});

module.exports = router;
