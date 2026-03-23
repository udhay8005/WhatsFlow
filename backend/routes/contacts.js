/**
 * @file contacts.js
 * @description Contact management REST API routes.
 *              Handles blacklist add, list, remove, and pre-campaign
 *              eligibility checks (blacklist + 24-hour frequency guard).
 * @module backend/routes/contacts
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/contacts/blacklist - Add to blacklist
router.post('/blacklist', (req, res) => {
    const { phone, reason } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const raw = phone.trim();
    if (!/^\+?\d{7,15}$/.test(raw)) {
        return res.status(400).json({ error: 'Invalid phone number. Use 7-15 digits, optionally starting with +' });
    }

    // Always normalize to +prefix so the blacklist JOIN in the worker matches
    // campaign phone numbers (which are stored with + in E.164 format)
    const normalized = raw.startsWith('+') ? raw : '+' + raw;

    db.run(
        'INSERT OR REPLACE INTO blacklist (phone_number, reason, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [normalized, reason],
        (err) => {
            if (err) {
                logger.error('Blacklist add error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true, message: 'Added to blacklist' });
        }
    );
});

// GET /api/contacts/blacklist - List blacklist
router.get('/blacklist', (req, res) => {
    db.all('SELECT * FROM blacklist ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            logger.error('Blacklist fetch error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// DELETE /api/contacts/blacklist/:phone - Remove from blacklist
router.delete('/blacklist/:phone', (req, res) => {
    // Express auto-decodes URI params, so %2B919... becomes +919...
    const phone = decodeURIComponent(req.params.phone);
    db.run('DELETE FROM blacklist WHERE phone_number = ?', [phone], (err) => {
        if (err) {
            logger.error('Blacklist delete error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, message: 'Removed from blacklist' });
    });
});

// SQLite hard limit for host parameters per statement (SQLITE_MAX_VARIABLE_NUMBER).
// Using 999 leaves headroom for all SQLite builds (default is 999; max possible is 32766).
const SQLITE_CHUNK_SIZE = 999;

/**
 * @function queryInChunks
 * @description Runs a parameterised query against an array of values in chunks to
 *              avoid exceeding SQLite's host-variable limit (~32 766 across all builds).
 *              Merges all result rows into a single flat array.
 * @param {string} sqlTemplate - SQL string with a single '/*PARAMS*\/' placeholder that
 *                               will be replaced with the correct number of '?' markers.
 * @param {any[]} values - Full array of values to chunk and bind.
 * @returns {Promise<any[]>} All matching rows across all chunks.
 */
function queryInChunks(sqlTemplate, values) {
    const chunks = [];
    for (let i = 0; i < values.length; i += SQLITE_CHUNK_SIZE) {
        chunks.push(values.slice(i, i + SQLITE_CHUNK_SIZE));
    }

    return chunks.reduce((chain, batch) => {
        return chain.then(acc => new Promise((resolve, reject) => {
            const placeholders = batch.map(() => '?').join(',');
            const sql = sqlTemplate.replace('/*PARAMS*/', placeholders);
            db.all(sql, batch, (err, rows) => {
                if (err) reject(err);
                else resolve(acc.concat(rows));
            });
        }));
    }, Promise.resolve([]));
}

// POST /api/contacts/check-eligibility - Check Blacklist & Frequency
router.post('/check-eligibility', asyncHandler(async (req, res) => {
    const { contacts } = req.body; // Array of { phone }
    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const uniqueNumbers = [...new Set(contacts.map(c => c.phone).filter(Boolean))];
    if (uniqueNumbers.length === 0) return res.json({ blacklisted: [], limited: [] });

    try {
        // 1. Check Blacklist (chunked to avoid SQLite parameter limit)
        const blacklistedPromise = queryInChunks(
            'SELECT phone_number, reason FROM blacklist WHERE phone_number IN (/*PARAMS*/)',
            uniqueNumbers
        );

        // 2. Check Frequency — Last 24 h (chunked)
        const frequencyPromise = queryInChunks(
            `SELECT phone_number, MAX(sent_at) as last_sent
             FROM messages
             WHERE phone_number IN (/*PARAMS*/)
             AND status = 'sent'
             AND sent_at > datetime('now','-24 hours')
             GROUP BY phone_number`,
            uniqueNumbers
        );

        const [blacklistedRows, frequencyRows] = await Promise.all([blacklistedPromise, frequencyPromise]);

        res.json({
            blacklisted: blacklistedRows.map(r => ({ phone: r.phone_number, reason: r.reason })),
            limited: frequencyRows.map(r => ({ phone: r.phone_number, lastSent: r.last_sent }))
        });

    } catch (err) {
        logger.error('Eligibility check error:', err);
        res.status(500).json({ error: 'Check failed' });
    }
}));

module.exports = router;
