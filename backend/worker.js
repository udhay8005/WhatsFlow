/**
 * @file worker.js
 * @description Background queue processor for outbound WhatsApp messages.
 *              Polls the database for queued messages, respects campaign rate limits,
 *              enforces blacklist exclusion via SQL JOIN, attempts WhatsApp delivery
 *              with automatic email fallback on eligible error codes, applies
 *              60-second backoff on rate-limit errors (130429 / 131056), skips
 *              retries for permanent failures (131026, 132001, etc.), and uses
 *              exponential backoff on DB errors to prevent runaway polling.
 * @module backend/worker
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const db = require('./database');
const whatsappService = require('./services/whatsappService');
const emailService = require('./services/emailService');
const logger = require('./utils/logger');

// Config
const POLL_INTERVAL = 2000; // 2 seconds
const RATE_LIMIT_TPS = 1; // Very conservative default

// Error codes that are permanent failures — no point retrying
// 131026: Recipient phone number not on WhatsApp
// 131047: Message failed to send because more than 24 hours have passed since the customer last replied
// 131051: Unsupported message type
// 131031: Business account locked/restricted
// 132001: Template language or locale code invalid
// 132007: Template does not exist
const WHATSAPP_ERROR_CODES_NO_RETRY = [131026, 131047, 131051, 131031, 132001, 132007];

// Error codes that are eligible for email fallback (recipient unreachable on WhatsApp)
const WHATSAPP_ERROR_CODES_FOR_FALLBACK = [131026, 131051, 131031];

// Error codes that indicate a rate limit — slow down sending
// 130429: Rate limit hit; 131056: Pair rate limit hit
const WHATSAPP_ERROR_CODES_RATE_LIMIT = [130429, 131056];
const RATE_LIMIT_BACKOFF_MS = 60000; // 60s pause when rate limited

let isRunning = false;
let errorCount = 0;

/**
 * @function startWorker
 * @description Initialises and starts the message queue processor.
 *              Resets any messages stuck in 'processing' status (from a prior crash)
 *              back to 'queued' before beginning the first poll cycle.
 * @param {import('socket.io').Server} io - Socket.IO server instance for real-time updates.
 */
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

/**
 * @function stopWorker
 * @description Signals the queue processor to stop after the current cycle completes.
 *              Safe to call from graceful-shutdown handlers.
 */
function stopWorker() {
    isRunning = false;
    logger.info('Stopped queue processor');
}

/**
 * @function getRateLimit
 * @description Reads the configured max_tps value from app_config, decrypts it,
 *              and clamps it between 1 and 100. Falls back to 1 TPS on any error.
 * @param {function(number): void} cb - Callback receiving the effective TPS value.
 */
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

/**
 * @function processQueue
 * @description Core polling loop. Fetches one eligible message per tick, acquires
 *              an optimistic lock (queued → processing), then delegates to
 *              proceedToSend(). Reschedules itself via setTimeout for rate-limiting
 *              and uses exponential backoff on DB errors.
 * @param {import('socket.io').Server} io - Socket.IO server instance.
 */
function processQueue(io) {
    if (!isRunning) return;

    // 1. Get dynamic rate limit first
    getRateLimit((currentTps) => {

        // 2. Fetch next queued or retry-eligible message (excluding blacklisted contacts)
        const sql = `
            SELECT m.*, c.template_name, c.template_language, c.name as campaign_name, c.media_id, c.media_type, ct.email, ct.email_opt_in
            FROM messages m
            JOIN campaigns c ON m.campaign_id = c.id
            LEFT JOIN contacts ct ON m.contact_id = ct.id
            LEFT JOIN blacklist bl ON m.phone_number = bl.phone_number
            WHERE m.status IN ('queued', 'processing')
              AND m.retry_count < m.max_retries
              AND c.status = 'active'
              AND bl.phone_number IS NULL
              AND (c.scheduled_at IS NULL OR datetime(c.scheduled_at) <= datetime('now'))
            ORDER BY m.id ASC
            LIMIT 1
        `;

        db.get(sql, [], async (err, msg) => {
            if (err) {
                logger.error('DB Error:', err);
                errorCount++;
                // Exponential backoff: 4s, 8s, 16s, ... up to 60s
                const backoffDelay = Math.min(POLL_INTERVAL * Math.pow(2, errorCount), 60000);
                logger.warn(`DB error count: ${errorCount}, retrying in ${backoffDelay}ms`);
                setTimeout(() => processQueue(io), backoffDelay);
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
                proceedToSend(msg, currentTps, io).catch(err => {
                    logger.error(`Unhandled error in proceedToSend for Msg ${msg.id}:`, err);
                    // Mark as failed to prevent infinite loop
                    db.run("UPDATE messages SET status='failed', error_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        ['Internal processing error', msg.id]);
                    setTimeout(() => processQueue(io), POLL_INTERVAL);
                });
            });

        });
    });
}

/**
 * @function proceedToSend
 * @description Sends a single message via WhatsApp. On permanent failure codes
 *              (131026: not on WA, 132001: bad template language, etc.) marks failed
 *              immediately without retry. On eligible codes (131026, 131051, 131031)
 *              attempts email fallback if contact has opted in. On rate-limit codes
 *              (130429, 131056) re-queues and pauses the entire worker 60s.
 *              Updates message status and campaign counters after each outcome.
 * @param {object} msg - Message row joined with campaign, contact, and blacklist data.
 * @param {number} currentTps - Current rate limit (transactions per second).
 * @param {import('socket.io').Server} io - Socket.IO server instance.
 * @returns {Promise<void>}
 */
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
            msg.template_language || 'en_US',
            components,
            msg.media_id,
            msg.media_type
        );

        // Success
        const waId = waRes.messages?.[0]?.id || `unknown_${Date.now()}`;
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

        const isRateLimit = errorCode && WHATSAPP_ERROR_CODES_RATE_LIMIT.includes(errorCode);
        const isNoRetry = errorCode && WHATSAPP_ERROR_CODES_NO_RETRY.includes(errorCode);
        const isFallbackEligible = errorCode && WHATSAPP_ERROR_CODES_FOR_FALLBACK.includes(errorCode);

        // Rate limit — log prominently and pause the worker for 60s
        if (isRateLimit) {
            logger.warn(`Rate limit hit (code ${errorCode}) for campaign ${msg.campaign_id} — pausing 60s`);
        }

        let finalStatus = 'failed';
        let finalChannel = 'whatsapp';

        // B. Attempt Email Fallback (only for unreachable-on-WhatsApp codes)
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

        // Retry only if: retries remain AND it's not a permanent error AND not rate-limited
        // Rate-limited messages go back to queued so they retry after the backoff delay
        const isPermanentFailure = isNoRetry || (msg.retry_count + 1 >= msg.max_retries);
        const shouldRetry = !isPermanentFailure || isRateLimit;
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

        // If rate-limited, pause queue for 60s before next poll
        if (isRateLimit) {
            setTimeout(() => processQueue(io), RATE_LIMIT_BACKOFF_MS);
            return;
        }
    }

    // Dynamic Rate Limit Delay
    setTimeout(() => processQueue(io), 1000 / currentTps);
}
// End proceedToSend

/**
 * @function updateCampaignStats
 * @description Increments the success_count or failed_count column for a campaign
 *              and emits a 'campaign_progress' Socket.IO event to update the UI.
 * @param {number} campaignId - Database ID of the campaign to update.
 * @param {'success'|'failed'} type - Which counter to increment.
 * @param {import('socket.io').Server} io - Socket.IO server instance.
 */
function updateCampaignStats(campaignId, type, io) {
    // secure update using parameterized query logic
    const isSuccess = type === 'success';
    db.run(
        `UPDATE campaigns SET success_count = success_count + ?, failed_count = failed_count + ? WHERE id = ?`,
        [isSuccess ? 1 : 0, !isSuccess ? 1 : 0, campaignId],
        (err) => {
            if (err) {
                logger.error(`Failed to update campaign ${type} count:`, err);
                return;
            }
            if (io) {
                io.emit('campaign_progress', { id: campaignId, type });
            }

            // Auto-complete: if all messages are processed, mark campaign as completed
            db.get(
                `SELECT total_count, success_count, failed_count FROM campaigns WHERE id = ?`,
                [campaignId],
                (err2, campaign) => {
                    if (err2 || !campaign) return;
                    const processed = (campaign.success_count || 0) + (campaign.failed_count || 0);
                    if (processed >= campaign.total_count && campaign.total_count > 0) {
                        db.run(
                            `UPDATE campaigns SET status = 'completed' WHERE id = ? AND status = 'active'`,
                            [campaignId],
                            (err3) => {
                                if (!err3) {
                                    logger.info(`Campaign ${campaignId} completed (${campaign.success_count} sent, ${campaign.failed_count} failed)`);
                                    if (io) io.emit('campaign_completed', { id: campaignId });
                                }
                            }
                        );
                    }
                }
            );
        }
    );
}

module.exports = {
    startWorker,
    stopWorker,
    // Export for testing only
    testableProcessQueue: processQueue
};
