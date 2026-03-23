/**
 * @file campaigns.js
 * @description Campaign management REST API routes.
 *              Handles create, read, update, delete, pause, and resume operations
 *              for bulk WhatsApp messaging campaigns.
 *              Contact inserts are processed sequentially to respect SQLite's
 *              single-writer constraint and avoid SQLITE_BUSY errors.
 * @module backend/routes/campaigns
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const logger = require('../utils/logger');
const { validateCampaignCreation } = require('../middleware/validators');
const { asyncHandler } = require('../middleware/errorHandler');

// Dedicated writer connection for multi-statement transactions.
// All BEGIN/INSERT/COMMIT work happens on this connection so that reads and
// lightweight writes from worker.js, stats, etc. (which use the main `db`
// connection) are completely isolated from the campaign transaction.
// See database.js for the full rationale.
const txnDb = db.dbWriter;

/**
 * @function dbRun
 * @description Promisified wrapper for txnDb.run (the writer connection).
 *              Resolves with the sqlite3 statement context (this.lastID / this.changes).
 * @param {string} sql - SQL statement to execute.
 * @param {any[]} [params=[]] - Bound parameters.
 * @returns {Promise<object>} sqlite3 statement context (this.lastID, this.changes).
 */
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        txnDb.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

/**
 * @function dbGet
 * @description Promisified wrapper for txnDb.get (the writer connection).
 *              Resolves with the first matching row, or undefined if no row matches.
 * @param {string} sql - SQL query.
 * @param {any[]} [params=[]] - Bound parameters.
 * @returns {Promise<object|undefined>} First matching row, or undefined.
 */
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        txnDb.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Application-level write-transaction mutex.
// node-sqlite3 exposes a single shared connection object; if two async write
// transactions run concurrently they both call BEGIN on that same connection and
// the second one throws: SQLITE_ERROR: cannot start a transaction within a transaction.
// This Promise-chain queue ensures only one write transaction is active at a time.
let writeMutex = Promise.resolve();

/**
 * @function withWriteLock
 * @description Serialises async write transactions on the shared SQLite connection.
 *              Each call appends fn to a Promise chain; concurrent callers wait
 *              until the previous operation resolves or rejects before proceeding.
 * @param {function(): Promise<void>} fn - Async function to run under the lock.
 * @returns {Promise<void>} Resolves or rejects with fn's result.
 */
function withWriteLock(fn) {
    const result = writeMutex.then(() => fn());
    writeMutex = result.then(() => {}, () => {}); // always advance chain on success or error
    return result;
}

// GET /api/campaigns
// List recent campaigns
router.get('/', (req, res) => {
    const sql = `
        SELECT * FROM campaigns 
        ORDER BY created_at DESC 
        LIMIT 50
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/campaigns/templates
// Fetch templates from Meta via Service
router.get('/templates', asyncHandler(async (req, res) => {
    try {
        const templates = await require('../services/whatsappService').getTemplates();
        res.json({ data: templates });
    } catch (error) {
        // Credentials not yet configured — return empty list with an informational
        // status so the frontend can show a "configure credentials" prompt instead
        // of treating it as a server crash (which floods the console with 500s).
        const isConfigError = error.message?.includes('missing') ||
            error.message?.includes('not configured') ||
            error.message?.includes('not set');
        if (isConfigError) {
            return res.json({ data: [], status: 'unconfigured', message: error.message });
        }
        res.status(500).json({ error: error.message });
    }
}));

// GET /api/campaigns/:id
// Get details + message stats
router.get('/:id', (req, res) => {
    const campaignId = req.params.id;

    const campaignSql = `SELECT * FROM campaigns WHERE id = ?`;
    const messagesSql = `SELECT * FROM messages WHERE campaign_id = ? ORDER BY id ASC LIMIT 1000`;

    db.get(campaignSql, [campaignId], (err, campaign) => {
        if (err || !campaign) return res.status(404).json({ error: "Campaign not found" });

        db.all(messagesSql, [campaignId], (err2, messages) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ ...campaign, messages });
        });
    });
});

// POST /api/campaigns
// Create a new campaign and enqueue messages
router.post('/', validateCampaignCreation, asyncHandler(async (req, res) => {
    // Body: { name, templateName, templateLanguage, contacts, mediaId, mediaType }
    const { name, templateName, templateLanguage = 'en_US', contacts = [], mediaId, mediaType } = req.body;

    // E.164 format: + followed by 1-15 digits
    const E164_REGEX = /^\+[1-9]\d{1,14}$/;
    const invalidContacts = contacts.filter(c => !c.phone || !E164_REGEX.test(c.phone));
    if (invalidContacts.length > 0) {
        return res.status(400).json({
            error: `Invalid phone numbers detected (${invalidContacts.length} contacts)`,
            sample: invalidContacts[0]?.phone
        });
    }

    const io = req.app.get('io');
    const status = req.body.status || 'active';
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    await withWriteLock(async () => {
        try {
            await dbRun("BEGIN");

            // 1. Create Campaign
            const campaignResult = await dbRun(
                `INSERT INTO campaigns (name, template_name, template_language, total_count, status, scheduled_at, media_id, media_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, templateName || '', templateLanguage, contacts.length, status, req.body.scheduledAt || null, mediaId || null, mediaType || null]
            );
            const campaignId = campaignResult.lastID;

            // 2. Insert contacts and messages sequentially (SQLite single-writer)
            let processed = 0;
            for (const contact of contacts) {
                let email = contact.email?.trim() || null;
                if (email && !EMAIL_REGEX.test(email)) email = null;
                const paramsJson = JSON.stringify(contact.params || []);

                await dbRun(
                    `INSERT INTO contacts (phone_number, email, email_opt_in)
                     VALUES (?, ?, 1)
                     ON CONFLICT(phone_number) DO UPDATE SET email=excluded.email, email_opt_in=1`,
                    [contact.phone, email]
                );

                const row = await dbGet("SELECT id FROM contacts WHERE phone_number = ?", [contact.phone]);
                if (!row) throw new Error(`Contact not found after upsert: ${contact.phone}`);

                await dbRun(
                    `INSERT INTO messages (campaign_id, contact_id, phone_number, variable_data, status) VALUES (?, ?, ?, ?, 'queued')`,
                    [campaignId, row.id, contact.phone, paramsJson]
                );
                processed++;
            }

            await dbRun("COMMIT");

            io.emit('campaign_created', { id: campaignId, name });
            res.status(201).json({
                success: true,
                campaignId,
                message: `Campaign created with ${contacts.length} messages.`,
                processed
            });
        } catch (err) {
            logger.error('Campaign creation failed:', err);
            try { await dbRun("ROLLBACK"); } catch (_) { /* ignore secondary rollback error */ }
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    });
}));

// POST /api/campaigns/:id/pause
router.post('/:id/pause', (req, res) => {
    const id = req.params.id;
    db.run("UPDATE campaigns SET status = 'paused' WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Campaign paused' });
    });
});

// POST /api/campaigns/:id/resume
router.post('/:id/resume', (req, res) => {
    const id = req.params.id;
    db.run("UPDATE campaigns SET status = 'active' WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Campaign resumed' });
    });
});

// DELETE /api/campaigns/:id
// Delete a campaign and its messages
router.delete('/:id', (req, res) => {
    const id = req.params.id;

    db.serialize(() => {
        // Delete messages first
        db.run('DELETE FROM messages WHERE campaign_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete messages: ' + err.message });

            // Then delete campaign
            db.run('DELETE FROM campaigns WHERE id = ?', [id], function (err) {
                if (err) return res.status(500).json({ error: 'Failed to delete campaign: ' + err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Campaign not found' });

                res.json({ success: true, message: 'Campaign deleted successfully' });
            });
        });
    });
});

// PUT /api/campaigns/:id
// Update campaign (e.g. Draft -> Active, or editing Draft)
router.put('/:id', (req, res) => {
    const campaignId = req.params.id;
    const { name, templateName, templateLanguage = 'en_US', contacts, status, scheduledAt, mediaId, mediaType } = req.body;

    // If we are just updating status (Draft -> Active)
    if (status && !contacts) {
        db.run(
            "UPDATE campaigns SET status = ?, scheduled_at = ? WHERE id = ?",
            [status, scheduledAt || null, campaignId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            }
        );
        return;
    }

    // Full Update (Re-create messages) — pure async/await transaction, no db.serialize()
    if (contacts) {
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        withWriteLock(async () => {
            try {
                await dbRun("BEGIN");

                // 1. Update Campaign
                await dbRun(
                    `UPDATE campaigns SET name=?, template_name=?, template_language=?, total_count=?, status=?, scheduled_at=?, media_id=?, media_type=? WHERE id=?`,
                    [name, templateName, templateLanguage, contacts.length, status || 'active', scheduledAt || null, mediaId || null, mediaType || null, campaignId]
                );

                // 2. Delete Old Messages
                await dbRun("DELETE FROM messages WHERE campaign_id = ?", [campaignId]);

                // 3. Insert New Messages sequentially
                for (const contact of contacts) {
                    let email = contact.email?.trim() || null;
                    if (email && !EMAIL_REGEX.test(email)) email = null;
                    const paramsJson = JSON.stringify(contact.params || []);

                    await dbRun(
                        `INSERT INTO contacts (phone_number, email, email_opt_in)
                         VALUES (?, ?, 1)
                         ON CONFLICT(phone_number) DO UPDATE SET email=excluded.email, email_opt_in=1`,
                        [contact.phone, email]
                    );

                    const row = await dbGet("SELECT id FROM contacts WHERE phone_number = ?", [contact.phone]);
                    const contactId = row ? row.id : null;

                    await dbRun(
                        `INSERT INTO messages (campaign_id, contact_id, phone_number, variable_data, status) VALUES (?, ?, ?, ?, 'queued')`,
                        [campaignId, contactId, contact.phone, paramsJson]
                    );
                }

                await dbRun("COMMIT");
                res.json({ success: true, id: campaignId, message: "Campaign updated" });
            } catch (err) {
                logger.error('Campaign update failed:', err);
                try { await dbRun("ROLLBACK"); } catch (_) { /* ignore secondary rollback error */ }
                if (!res.headersSent) res.status(500).json({ error: err.message });
            }
        });
        return;
    }

    // Neither status-only nor contacts update — nothing to do
    res.status(400).json({ error: 'No valid update data provided. Include status or contacts.' });
});

module.exports = router;
