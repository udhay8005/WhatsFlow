/**
 * @file whatsappService.js
 * @description Meta WhatsApp Business API integration service.
 *              Handles template message sending, media upload, and
 *              approved template retrieval via Graph API v21.0.
 * @module backend/services/whatsappService
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const axios = require('axios');
const db = require('../database');
const cryptoService = require('./cryptoService');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

const GRAPH_VERSION = process.env.WA_API_VERSION || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * @function getCredentials
 * @description Retrieves and decrypts WhatsApp API credentials from the database.
 * @returns {Promise<{wa_access_token: string, wa_phone_id: string, wa_waba_id: string}>}
 * @throws {Error} If credentials are not yet configured.
 */
async function getCredentials() {
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM app_config WHERE key IN ('wa_access_token', 'wa_phone_id', 'wa_waba_id')", [], (err, rows) => {
            if (err) return reject(err);
            const creds = {};
            rows.forEach(row => {
                creds[row.key] = cryptoService.decrypt(row.value);
            });

            if (!creds.wa_access_token || !creds.wa_phone_id) {
                return reject(new Error('WhatsApp credentials not configured.'));
            }
            resolve(creds);
        });
    });
}

const whatsappService = {
    /**
     * @function uploadMedia
     * @description Uploads a local file to the WhatsApp media endpoint and
     *              returns the hosted media ID for use in template messages.
     * @param {string} filePath - Absolute path to the temporary upload file.
     * @param {string} mimeType - Detected MIME type (image/jpeg, image/png, video/mp4).
     * @returns {Promise<string>} The WhatsApp media ID.
     * @throws {Error} On API failure or credential error.
     */
    async uploadMedia(filePath, mimeType) {
        const creds = await getCredentials();
        const url = `${BASE_URL}/${creds.wa_phone_id}/media`;

        const formData = new FormData();
        formData.append('messaging_product', 'whatsapp');
        formData.append('file', fs.createReadStream(filePath), {
            contentType: mimeType,
            filename: filePath.split(/[/\\]/).pop()
        });

        try {
            const response = await axios.post(url, formData, {
                headers: {
                    'Authorization': `Bearer ${creds.wa_access_token}`,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            logger.info('WhatsApp media uploaded: ' + response.data.id);
            return response.data.id; // media_id
        } catch (error) {
            logger.error('WhatsApp media upload failed:', error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * @function sendMessage
     * @description Sends a WhatsApp template message to a single recipient.
     *              Optionally prepends a HEADER component when mediaId is provided.
     * @param {string} to - Recipient phone number in E.164 format.
     * @param {string} templateName - Approved template name.
     * @param {string} languageCode - Language code (e.g. 'en_US').
     * @param {Array<object>} components - Template body/header parameter components.
     * @param {string|null} [mediaId] - WhatsApp media ID for header attachment.
     * @param {string|null} [mediaType] - 'image' or 'video'.
     * @returns {Promise<{messages: Array<{id: string}>}>} API response with message IDs.
     * @throws {Error} On API failure.
     */
    async sendMessage(to, templateName, languageCode, components, mediaId, mediaType) {
        const creds = await getCredentials();
        const url = `${BASE_URL}/${creds.wa_phone_id}/messages`;

        // Build components array
        const finalComponents = components ? [...components] : [];

        // If mediaId provided, prepend HEADER component
        if (mediaId && mediaType) {
            const headerParam = mediaType === 'image'
                ? { type: 'image', image: { id: mediaId } }
                : { type: 'video', video: { id: mediaId } };

            finalComponents.unshift({
                type: 'header',
                parameters: [headerParam]
            });
        }

        const payload = {
            messaging_product: "whatsapp",
            to: to, // E.164 format with + prefix — Meta v21.0 accepts "+16505551234"
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
                components: finalComponents
            }
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${creds.wa_access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data; // { messages: [{ id: "..." }] }
        } catch (error) {
            logger.error('WhatsApp send failed:', error.response ? error.response.data : error.message);
            throw error;
        }
    },

    /**
     * @function getTemplates
     * @description Fetches all approved message templates from the WABA.
     * @returns {Promise<Array<object>>} Array of template objects from Meta.
     * @throws {Error} If WABA ID is missing or API call fails.
     */
    async getTemplates() {
        const creds = await getCredentials();
        // WABA ID is optional if searching via Phone ID, but better to use WABA ID for templates
        // Endpoint: /<WABA_ID>/message_templates
        const targetId = creds.wa_waba_id;
        if (!targetId) throw new Error("WABA ID missing");

        const url = `${BASE_URL}/${targetId}/message_templates`;
        const headers = { 'Authorization': `Bearer ${creds.wa_access_token}` };

        try {
            let all = [];
            let nextUrl = url;
            let params = { limit: 100, status: 'APPROVED' };

            // Follow pagination cursors so all templates are returned
            while (nextUrl) {
                const response = await axios.get(nextUrl, { params, headers });
                const page = response.data.data || [];
                all = all.concat(page);
                // After first request, use cursor — not query params
                params = undefined;
                nextUrl = response.data.paging?.cursors?.after
                    ? `${url}?after=${response.data.paging.cursors.after}&limit=100&status=APPROVED`
                    : null;
                // Safety: stop after 10 pages (1000 templates)
                if (all.length >= 1000) break;
            }

            return all.filter(t => t.status === 'APPROVED');
        } catch (error) {
            logger.error('WhatsApp get templates failed:', error.response?.data || error.message);
            throw error;
        }
    }
};

module.exports = whatsappService;
