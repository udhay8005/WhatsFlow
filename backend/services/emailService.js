const nodemailer = require('nodemailer');
const db = require('../database');
const cryptoService = require('./cryptoService');
const logger = require('../utils/logger');

// Helper: Get SMTP Creds from DB
async function getSmtpCredentials() {
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM app_config WHERE key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure')", [], (err, rows) => {
            if (err) return resolve(null);

            const config = {};
            rows.forEach(row => { config[row.key] = row.value; });

            if (!config.smtp_host || !config.smtp_user) return resolve(null);

            // Return config object with encrypted pass, decrypt only at point of use
            resolve(config);
        });
    });
}

const emailService = {
    async sendFallbackEmail(toEmail, textBody, subject = "Important Message") {
        const config = await getSmtpCredentials();
        if (!config) {
            logger.info('Skipping email fallback - SMTP not configured');
            return false;
        }

        const transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port: parseInt(config.smtp_port) || 587,
            secure: config.smtp_secure === 'true',
            auth: {
                user: config.smtp_user,
                pass: config.smtp_pass ? cryptoService.decrypt(config.smtp_pass) : '', // Decrypt here
            },
        });

        const mailOptions = {
            from: `"WhatsFlow Bot" <${config.smtp_user}>`,
            to: toEmail,
            subject: subject,
            text: textBody, // Plain text for now, could be HTML
            html: `<p>${textBody.replace(/\n/g, '<br>')}</p><hr><p style="font-size:11px; color:gray">You received this email because we could not reach you on WhatsApp.</p>`
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
