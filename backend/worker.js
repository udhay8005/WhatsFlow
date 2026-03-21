const db = require('./database');
const whatsappService = require('./services/whatsappService');
const emailService = require('./services/emailService');
const logger = require('./utils/logger');

// Config
const POLL_INTERVAL = 2000; // 2 seconds
const RATE_LIMIT_TPS = 1; // Very conservative default
const WHATSAPP_ERROR_CODES_FOR_FALLBACK = [131026, 131047, 131051, 131031]; // Not on WhatsApp, Invalid number, etc

let isRunning = false;
let errorCount = 0;
const MAX_SEQUENTIAL_ERRORS = 10;

function startWorker(io) {
    if (isRunning) return;

    // Reset any messages stuck in 'processing' state from previous run
    db.run("UPDATE messages SET status='queued' WHERE status='processing'", [], (err) => {
        if (err) logger.error('Failed to reset stuck messages:', err);
        else logger.info('Reset stuck messages to queued');

        isRunning = true;
        logger.info('Started queue processor');
        processQueue(io);
    });
}

function stopWorker() {
    isRunning = false;
    logger.info('Stopped queue processor');
}

// Helper to get rate limit
function getRateLimit(cb) {
    db.get("SELECT value FROM app_config WHERE key = 'max_tps'", (err, row) => {
        if (err || !row) return cb(1);
        try {
            const val = parseInt(require('./services/cryptoService').decrypt(row.value));
            const bounded = Math.max(1, Math.min(val || 1, 100)); // Clamp between 1-100
            cb(bounded);
        } catch (e) {
            cb(1);
        }
    });
}

function processQueue(io) {
    if (!isRunning) return;

    // 1. Get dynamic rate limit first
    getRateLimit((currentTps) => {

        // 2. Fetch next queued or retry-eligible message
        const sql = `
            SELECT m.*, c.template_name, c.name as campaign_name, c.media_id, c.media_type, ct.email, ct.email_opt_in 
            FROM messages m
            JOIN campaigns c ON m.campaign_id = c.id
            LEFT JOIN contacts ct ON m.contact_id = ct.id 
            WHERE m.status IN ('queued', 'processing') 
              AND m.retry_count < m.max_retries
              AND c.status = 'active'
              AND (c.scheduled_at IS NULL OR datetime(c.scheduled_at) <= datetime('now'))
            ORDER BY m.id ASC
            LIMIT 1
        `;

        db.get(sql, [], async (err, msg) => {
            if (err) {
                logger.error('DB Error:', err);
                errorCount++;
                if (errorCount >= MAX_SEQUENTIAL_ERRORS) {
                    logger.error('Too many sequential errors, stopping worker');
                    stopWorker();
                    return;
                }
                setTimeout(() => processQueue(io), POLL_INTERVAL * 2);
                return;
            }

            errorCount = 0; // Reset on success

            if (!msg) {
                // Queue empty, wait and retry
                setTimeout(() => processQueue(io), POLL_INTERVAL);
                return;
            }

            // 3. Process Message
            logger.info(`Processing Msg ${msg.id} for ${msg.phone_number} (Tps: ${currentTps})`);

            // Mark as Processing with Optimistic Locking
            // Only proceed if we successfully transition from queued -> processing
            // or if we catch a stuck 'processing' item we just selected
            db.run("UPDATE messages SET status='processing', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued', 'processing')", [msg.id], function (err) {
                if (err) {
                    logger.error('Failed to lock message:', err);
                    setTimeout(() => processQueue(io), 100);
                    return;
                }

                // If changes == 0, another worker stole it, or it was cancelled. Skip.
                if (this.changes === 0) {
                    logger.warn(`Race condition detected for Msg ${msg.id}, skipping...`);
                    setTimeout(() => processQueue(io), 100);
                    return;
                }

                // Lock acquired, proceed to send
                proceedToSend(msg, currentTps, io);
            });

        });
    });
}

async function proceedToSend(msg, currentTps, io) {
    io.emit('status_update', { id: msg.wa_message_id || msg.id, status: 'processing' });

    try {
        // Prepare Params
        let params = [];
        try {
            params = JSON.parse(msg.variable_data || '[]');
        } catch (e) {
            logger.error('Invalid JSON in variable_data:', e);
        }

        // Construct Components
        const components = [];
        if (params.length > 0) {
            const bodyParams = params.map(p => ({ type: 'text', text: String(p) }));
            components.push({ type: 'body', parameters: bodyParams });
        }

        // A. Attempt WhatsApp
        const waRes = await whatsappService.sendMessage(
            msg.phone_number,
            msg.template_name,
            'en_US',
            components,
            msg.media_id,
            msg.media_type
        );

        // Success
        const waId = waRes.messages[0].id;
        db.run(
            "UPDATE messages SET status='sent', wa_message_id=?, sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            [waId, msg.id],
            (err) => {
                if (err) logger.error('Failed to update success status:', err);
                else {
                    updateCampaignStats(msg.campaign_id, 'success', io);
                    io.emit('status_update', { id: waId, status: 'sent' });
                }
            }
        );
        logger.info(`Sent WA: ${waId}`);

    } catch (waErr) {
        logger.warn(`WA Failed for ${msg.phone_number}: ${waErr.message}`);

        const errorCode = waErr.response?.data?.error?.code;
        const errorMessage = waErr.response?.data?.error?.message || waErr.message;
        const isFallbackEligible = errorCode && WHATSAPP_ERROR_CODES_FOR_FALLBACK.includes(errorCode);

        let finalStatus = 'failed';
        let finalChannel = 'whatsapp';

        // B. Attempt Email Fallback
        if (isFallbackEligible && msg.email && msg.email_opt_in) {
            logger.info(`Attempting Email Fallback for ${msg.email}`);
            try {
                const emailId = await emailService.sendFallbackEmail(
                    msg.email,
                    `Hello,\n\nWe tried to reach you on WhatsApp but were unable to deliver the message.\n\nCampaign: ${msg.campaign_name}\nTemplate: ${msg.template_name}\n\nPlease check your WhatsApp number or contact support.`
                );

                if (emailId) {
                    finalStatus = 'sent';
                    finalChannel = 'email';
                    logger.info(`Email fallback successful: ${emailId}`);
                }
            } catch (emailErr) {
                logger.error('Email fallback also failed:', emailErr.message);
                finalStatus = 'failed';
                finalChannel = 'email';
            }
        }

        const shouldRetry = msg.retry_count < msg.max_retries - 1 && !isFallbackEligible;
        const newStatus = shouldRetry ? 'queued' : finalStatus;
        const newRetryCount = msg.retry_count + 1;

        db.run(
            `UPDATE messages SET 
                        status=?, 
                        error_reason=?, 
                        final_channel=?, 
                        fallback_attempted=?,
                        retry_count=?,
                        updated_at=CURRENT_TIMESTAMP 
                    WHERE id=?`,
            [newStatus, errorMessage, finalChannel, isFallbackEligible ? 1 : 0, newRetryCount, msg.id],
            (err) => {
                if (err) logger.error('Failed to update error status:', err);
                else {
                    if (newStatus === 'failed') {
                        updateCampaignStats(msg.campaign_id, 'failed', io);
                    }
                    io.emit('status_update', { id: msg.id, status: newStatus, channel: finalChannel });
                }
            }
        );
    }

    // Dynamic Rate Limit Delay
    setTimeout(() => processQueue(io), 1000 / currentTps);
}
// End proceedToSend

// Helper to update campaign statistics
function updateCampaignStats(campaignId, type, io) {
    // secure update using parameterized query logic
    const isSuccess = type === 'success';
    db.run(
        `UPDATE campaigns SET success_count = success_count + ?, failed_count = failed_count + ? WHERE id = ?`,
        [isSuccess ? 1 : 0, !isSuccess ? 1 : 0, campaignId],
        (err) => {
            if (err) logger.error(`Failed to update campaign ${type} count:`, err);
            else if (io) {
                io.emit('campaign_progress', { id: campaignId, type });
            }
        }
    );
}

module.exports = {
    startWorker,
    stopWorker,
    // Export for testing only
    testableProcessQueue: processQueue
};
