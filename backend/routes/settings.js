const express = require('express');
const router = express.Router();
const db = require('../database');
const cryptoService = require('../services/cryptoService');
const { validateSettings } = require('../middleware/validators');
const { getTunnelUrl, isTunnelActive } = require('../tunnelManager');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

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
        'webhook_verify_token',
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
        'max_tps'
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

        // Special handling for max_tps: return actual value
        const tpsRow = rows.find(r => r.key === 'max_tps');
        if (tpsRow) {
            status.max_tps = cryptoService.decrypt(tpsRow.value);
        } else {
            status.max_tps = '1'; // Default
        }

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

    const stmt = db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)");

    const encryptAndSave = (key, val) => {
        if (val === null || val === '') return;
        const encrypted = cryptoService.encrypt(String(val));
        stmt.run(key, encrypted);
    };

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        Object.entries(updates).forEach(([key, val]) => encryptAndSave(key, val));
        db.run("COMMIT", (err) => {
            stmt.finalize();
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Settings saved securely." });
        });
    });
});

// POST /api/settings/test-smtp
// Test SMTP connection with provided credentials
router.post('/test-smtp', async (req, res) => {
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
});

// GET /api/settings/tunnel
// Returns current tunnel URL if active
router.get('/tunnel', (req, res) => {
    const url = getTunnelUrl();
    const active = isTunnelActive();

    res.json({
        active: active,
        url: url ? `${url}/webhook` : null,
        baseUrl: url
    });
});

// POST /api/settings/clear-history
// Deletes all campaigns and messages
router.post('/clear-history', (req, res) => {
    try {
        db.serialize(() => {
            db.run('DELETE FROM messages', (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to clear messages: ' + err.message });
                }

                db.run('DELETE FROM campaigns', (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to clear campaigns: ' + err.message });
                    }

                    res.json({
                        success: true,
                        message: 'All campaign and message history cleared successfully'
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear history: ' + error.message });
    }
});

// POST /api/settings/clear-logs
// Clears log files (if logging to files is implemented)
router.post('/clear-logs', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logsDir = path.join(__dirname, '../../backend/logs');

        // Check if logs directory exists
        if (fs.existsSync(logsDir)) {
            const files = fs.readdirSync(logsDir);
            let cleared = 0;

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    fs.unlinkSync(path.join(logsDir, file));
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
    try {
        const fs = require('fs');
        const path = require('path');
        let actions = [];

        // 1. Clear logs
        const logsDir = path.join(__dirname, '../../backend/logs');
        if (fs.existsSync(logsDir)) {
            const files = fs.readdirSync(logsDir);
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    fs.unlinkSync(path.join(logsDir, file));
                }
            });
            actions.push('Cleared log files');
        }

        // 2. Remove temp upload files
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                // Delete files older than 24 hours
                const hoursSinceModified = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
                if (hoursSinceModified > 24) {
                    fs.unlinkSync(filePath);
                }
            });
            actions.push('Cleaned old uploaded files');
        }

        // 3. Optimize database (VACUUM)
        db.run('VACUUM', (err) => {
            if (err) {
                logger.error('Failed to optimize database:', err);
            } else {
                actions.push('Optimized database');
            }

            res.json({
                success: true,
                message: `App cleaned: ${actions.join(', ')}`
            });
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to clean app: ' + error.message });
    }
});

module.exports = router;
