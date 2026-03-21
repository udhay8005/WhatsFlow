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

// POST /api/contacts/blacklist - Add to blacklist
router.post('/blacklist', (req, res) => {
    const { phone, reason } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    db.run(
        'INSERT OR REPLACE INTO blacklist (phone_number, reason, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [phone, reason],
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
    const { phone } = req.params;
    db.run('DELETE FROM blacklist WHERE phone_number = ?', [phone], (err) => {
        if (err) {
            logger.error('Blacklist delete error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, message: 'Removed from blacklist' });
    });
});

// POST /api/contacts/check-eligibility - Check Blacklist & Frequency
router.post('/check-eligibility', async (req, res) => {
    const { contacts } = req.body; // Array of { phone }
    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const uniqueNumbers = [...new Set(contacts.map(c => c.phone).filter(Boolean))];
    if (uniqueNumbers.length === 0) return res.json({ blacklisted: [], limited: [] });

    try {
        // 1. Check Blacklist
        // Create placeholders for IN clause
        const placeholders = uniqueNumbers.map(() => '?').join(',');

        const blacklistedPromise = new Promise((resolve, reject) => {
            db.all(
                `SELECT phone_number, reason FROM blacklist WHERE phone_number IN (${placeholders})`,
                uniqueNumbers,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // 2. Check Frequency (Last 24h)
        const frequencyPromise = new Promise((resolve, reject) => {
            db.all(
                `SELECT phone_number, MAX(sent_at) as last_sent 
                 FROM messages 
                 WHERE phone_number IN (${placeholders}) 
                 AND status = 'sent' 
                 AND sent_at > datetime('now','-24 hours')
                 GROUP BY phone_number`,
                uniqueNumbers,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        const [blacklistedRows, frequencyRows] = await Promise.all([blacklistedPromise, frequencyPromise]);

        res.json({
            blacklisted: blacklistedRows.map(r => ({ phone: r.phone_number, reason: r.reason })),
            limited: frequencyRows.map(r => ({ phone: r.phone_number, lastSent: r.last_sent }))
        });

    } catch (err) {
        logger.error('Eligibility check error:', err);
        res.status(500).json({ error: 'Check failed' });
    }
});

module.exports = router;
