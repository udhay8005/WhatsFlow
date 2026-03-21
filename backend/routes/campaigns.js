const express = require('express');
const router = express.Router();
const db = require('../database');
const logger = require('../utils/logger');
const { validateCampaignCreation } = require('../middleware/validators');

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
router.get('/templates', async (req, res) => {
    try {
        const templates = await require('../services/whatsappService').getTemplates();
        res.json({ data: templates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
router.post('/', validateCampaignCreation, (req, res) => {
    // Body: { name, templateName, contacts, mediaId, mediaType }
    const { name, templateName, contacts = [], mediaId, mediaType } = req.body;


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

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const handleError = (err) => {
            logger.error('Campaign creation failed:', err);
            db.run("ROLLBACK");
            res.status(500).json({ error: err.message });
        };

        // 1. Create Campaign
        const status = req.body.status || 'active';
        db.run(
            `INSERT INTO campaigns (name, template_name, total_count, status, scheduled_at, media_id, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, templateName || '', contacts.length, status, req.body.scheduledAt || null, mediaId || null, mediaType || null],
            function (err) {
                if (err) return handleError(err);

                const campaignId = this.lastID;
                const errors = [];
                let processed = 0;

                // 2. Process Contacts (Async)
                const processContacts = async () => {
                    const BATCH_SIZE = 50;
                    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
                        const batch = contacts.slice(i, i + BATCH_SIZE);

                        await Promise.all(batch.map(contact => {
                            return new Promise((resolve, reject) => {
                                const email = contact.email?.trim() || null;
                                const paramsJson = JSON.stringify(contact.params || []);

                                // Upsert Contact
                                db.run(
                                    `INSERT INTO contacts (phone_number, email, email_opt_in) 
                                     VALUES (?, ?, 1)
                                     ON CONFLICT(phone_number) DO UPDATE SET email=excluded.email, email_opt_in=1`,
                                    [contact.phone, email],
                                    (insertErr) => {
                                        if (insertErr) {
                                            errors.push({ phone: contact.phone, error: insertErr.message });
                                            // Fail hard? Or log and continue? 
                                            // The audit demanded rollback on failure, but usually bulk ops might tolerate partials?
                                            // Let's assume critical failure for now to be safe as per audit.
                                            return reject(insertErr);
                                        }

                                        // Lookup ID and Insert Message
                                        db.get("SELECT id FROM contacts WHERE phone_number = ?", [contact.phone], (getErr, row) => {
                                            if (getErr || !row) return reject(getErr || new Error('Contact not found'));

                                            db.run(
                                                `INSERT INTO messages (campaign_id, contact_id, phone_number, variable_data, status) VALUES (?, ?, ?, ?, 'queued')`,
                                                [campaignId, row.id, contact.phone, paramsJson],
                                                (msgErr) => {
                                                    if (msgErr) return reject(msgErr);
                                                    processed++;
                                                    resolve();
                                                }
                                            );
                                        });
                                    }
                                );
                            });
                        }));
                    }
                };

                processContacts()
                    .then(() => {
                        db.run("COMMIT", (commitErr) => {
                            if (commitErr) return handleError(commitErr);

                            io.emit('campaign_created', { id: campaignId, name });
                            res.status(201).json({
                                success: true,
                                campaignId,
                                message: `Campaign created with ${contacts.length} messages.`,
                                processed,
                                errors: errors.length > 0 ? errors : undefined
                            });
                        });
                    })
                    .catch((err) => {
                        handleError(err);
                    });
            }
        );
    });
});

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
    const { name, templateName, contacts, status, scheduledAt, mediaId, mediaType } = req.body;

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

    // Full Update (Re-create messages)
    if (contacts) {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Update Campaign
            db.run(
                `UPDATE campaigns SET name=?, template_name=?, total_count=?, status=?, scheduled_at=?, media_id=?, media_type=? WHERE id=?`,
                [name, templateName, contacts.length, status || 'active', scheduledAt || null, mediaId || null, mediaType || null, campaignId],
                async function (err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }

                    // 2. Delete Old Messages
                    db.run("DELETE FROM messages WHERE campaign_id = ?", [campaignId], async (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: "Failed to clear old messages" });
                        }

                        // 3. Insert New Messages
                        try {
                            const BATCH_SIZE = 50;
                            for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
                                const batch = contacts.slice(i, i + BATCH_SIZE);
                                await Promise.all(batch.map(contact => {
                                    return new Promise((resolve, reject) => {
                                        const email = contact.email?.trim() || null;
                                        const paramsJson = JSON.stringify(contact.params || []);

                                        // Upsert Contact (Simple handling)
                                        db.run(
                                            `INSERT OR IGNORE INTO contacts (phone_number, email) VALUES (?, ?)`,
                                            [contact.phone, email],
                                            function (err) {
                                                // Get Contact ID
                                                db.get("SELECT id FROM contacts WHERE phone_number = ?", [contact.phone], (err, row) => {
                                                    const contactId = row ? row.id : null;
                                                    db.run(
                                                        `INSERT INTO messages (campaign_id, contact_id, phone_number, variable_data, status) VALUES (?, ?, ?, ?, 'queued')`,
                                                        [campaignId, contactId, contact.phone, paramsJson],
                                                        (err) => {
                                                            if (err) reject(err);
                                                            else resolve();
                                                        }
                                                    );
                                                });
                                            }
                                        );
                                    });
                                }));
                            }

                            db.run("COMMIT");
                            res.json({ success: true, id: campaignId, message: "Campaign updated" });

                        } catch (insertErr) {
                            db.run("ROLLBACK");
                            res.status(500).json({ error: insertErr.message });
                        }
                    });
                }
            );
        });
        return;
    }
});

module.exports = router;
