/**
 * @file stats.js
 * @description Statistics REST API routes.
 *              Provides aggregate dashboard counters, a 7-day delivery trend
 *              (with zero-fill for missing days), and a message-status distribution
 *              breakdown for charts and reporting.
 * @module backend/routes/stats
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/stats/dashboard
// Returns aggregate stats for the dashboard
router.get('/dashboard', (req, res) => {
    // We already have this logic in Dashboard.jsx via multiple API calls
    // But a dedicated endpoint is efficient.
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM campaigns) as total_campaigns,
            (SELECT COUNT(*) FROM messages WHERE status = 'sent') as total_sent,
            (SELECT COUNT(*) FROM messages WHERE status = 'failed') as total_failed,
            (SELECT COUNT(*) FROM messages WHERE status = 'queued' OR status = 'processing') as total_pending
    `;

    db.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// GET /api/stats/trend
// Returns daily message sending stats for the last 7 days
router.get('/trend', (req, res) => {
    const sql = `
        SELECT 
            strftime('%Y-%m-%d', sent_at) as date,
            COUNT(*) as count
        FROM messages 
        WHERE status = 'sent' 
          AND sent_at >= datetime('now', '-7 days')
        GROUP BY date
        ORDER BY date ASC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Fill in missing days
        const result = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const found = rows.find(r => r.date === dateStr);
            result.push({
                date: dateStr,
                count: found ? found.count : 0
            });
        }

        res.json(result);
    });
});

// GET /api/stats/status-distribution
// Returns breakup of message statuses for recent campaigns
router.get('/status-distribution', (req, res) => {
    const sql = `
        SELECT status, COUNT(*) as count 
        FROM messages 
        GROUP BY status
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
