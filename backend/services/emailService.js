/**
 * @file emailService.js
 * @description SMTP email fallback service used when WhatsApp delivery fails.
 *              Sends HTML + plain-text dual-format emails via Nodemailer.
 *              SMTP credentials are decrypted from the database at send time.
 * @module backend/services/emailService
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const nodemailer = require('nodemailer');
const db = require('../database');
const cryptoService = require('./cryptoService');
const logger = require('../utils/logger');

/**
 * @function getSmtpCredentials
 * @description Loads SMTP configuration from the database.
 * @returns {Promise<object|null>} Config object with smtp_host, port, user, pass, secure — or null if not configured.
 */
async function getSmtpCredentials() {
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM app_config WHERE key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from_email')", [], (err, rows) => {
            if (err) return resolve(null);

            const config = {};
            rows.forEach(row => {
                // All values in app_config are encrypted — decrypt each one
                try {
                    config[row.key] = cryptoService.decrypt(row.value);
                } catch (e) {
                    logger.error(`Failed to decrypt ${row.key}:`, e);
                    config[row.key] = '';
                }
            });

            if (!config.smtp_host || !config.smtp_user) return resolve(null);

            resolve(config);
        });
    });
}

/**
 * @function escapeHtml
 * @description Escapes HTML special characters to prevent XSS in email HTML body.
 * @param {string} text - Raw text that may contain user-supplied content.
 * @returns {string} Safely escaped HTML string.
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const emailService = {
    /**
     * @function sendFallbackEmail
     * @description Sends a fallback email when WhatsApp delivery is not possible.
     *              Builds a dual-format (HTML + plain text) email and delivers via SMTP.
     * @param {string} toEmail - Recipient email address.
     * @param {string} textBody - Plain-text message content.
     * @param {string} [subject='Important Message'] - Email subject line (configurable in Settings).
     * @param {string} [fromName='WhatsFlow Bot'] - Sender display name (configurable in Settings).
     * @returns {Promise<string|false>} Nodemailer messageId on success, false if SMTP not configured, null on error.
     */
    async sendFallbackEmail(toEmail, textBody, subject = 'Important Message', fromName = 'WhatsFlow Bot') {
        const config = await getSmtpCredentials();
        if (!config) {
            logger.info('Skipping email fallback - SMTP not configured');
            return false;
        }

        // Validate email format to mitigate nodemailer address-parsing DoS
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(toEmail)) {
            logger.warn('Invalid email address rejected: ' + toEmail);
            return null;
        }

        const transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port: parseInt(config.smtp_port) || 587,
            secure: config.smtp_secure === 'true',
            auth: {
                user: config.smtp_user,
                pass: config.smtp_pass || '',
            },
        });

        const fromAddress = config.smtp_from_email || config.smtp_user;
        const mailOptions = {
            from: `"${fromName}" <${fromAddress}>`,
            to: toEmail,
            subject: subject,
            text: textBody, // Plain text for now, could be HTML
            html: `<p>${escapeHtml(textBody).replace(/\n/g, '<br>')}</p><hr><p style="font-size:11px; color:gray">You received this email because we could not reach you on WhatsApp.</p>`
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            logger.info('Email sent: ' + info.messageId);
            return info.messageId;
        } catch (error) {
            logger.error('Email send failed:', error);
            return null;
        }
    }
};

module.exports = emailService;
