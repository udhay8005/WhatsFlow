const axios = require('axios');
const db = require('../database');
const cryptoService = require('./cryptoService');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

const GRAPH_VERSION = process.env.WA_API_VERSION || 'v19.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Helper: Get Credentials from DB
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
    // Upload Media to WhatsApp (Returns media_id)
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

    // Send a Template Message (with optional media)
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
            to: to, // Must be E.164
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

    // Fetch Templates (for UI dropdown)
    async getTemplates() {
        const creds = await getCredentials();
        // WABA ID is optional if searching via Phone ID, but better to use WABA ID for templates
        // Endpoint: /<WABA_ID>/message_templates
        const targetId = creds.wa_waba_id;
        if (!targetId) throw new Error("WABA ID missing");

        const url = `${BASE_URL}/${targetId}/message_templates`;

        try {
            const response = await axios.get(url, {
                params: { limit: 100 },
                headers: { 'Authorization': `Bearer ${creds.wa_access_token}` }
            });
            return response.data.data;
        } catch (error) {
            logger.error('WhatsApp get templates failed:', error.response?.data || error.message);
            throw error;
        }
    }
};

module.exports = whatsappService;
