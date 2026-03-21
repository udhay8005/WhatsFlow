const localtunnel = require('localtunnel');
const logger = require('./utils/logger');

let tunnel = null;
let tunnelUrl = null;

/**
 * Start LocalTunnel to expose localhost to the internet
 * @param {number} port - Local port to tunnel (default: 3000)
 * @param {string} subdomain - Custom subdomain (default: whatsflow)
 * @returns {Promise<string>} The public tunnel URL
 */
async function startTunnel(port = 3000, subdomain = 'whatsflow-dakshin') {
    try {
        logger.info('🔌 Starting LocalTunnel...');

        tunnel = await localtunnel({
            port: port,
            subdomain: subdomain
        });

        tunnelUrl = tunnel.url;

        logger.info('✅ LocalTunnel started successfully!');
        logger.info(`📡 Public Webhook URL: ${tunnelUrl}/webhook`);
        logger.info(`   Forwarding to: http://localhost:${port}`);
        logger.info('');
        logger.info('⚙️  Configure this URL in Meta Developer Console:');
        logger.info(`   1. Go to https://developers.facebook.com/`);
        logger.info(`   2. Your App → WhatsApp → Configuration → Webhook`);
        logger.info(`   3. Callback URL: ${tunnelUrl}/webhook`);
        logger.info(`   4. Verify Token: (from your Settings page)`);
        logger.info('');

        // Handle tunnel errors
        tunnel.on('error', (err) => {
            logger.error('LocalTunnel error:', err);
        });

        tunnel.on('close', () => {
            logger.warn('⚠️  LocalTunnel closed');
            tunnelUrl = null;
        });

        return tunnelUrl;
    } catch (error) {
        logger.error('❌ Failed to start LocalTunnel:', error.message);

        // Common error fixes
        if (error.message.includes('subdomain')) {
            logger.error('   💡 Subdomain might be taken. Try a different name in tunnelManager.js');
        }

        throw error;
    }
}

/**
 * Stop the active tunnel
 */
async function stopTunnel() {
    try {
        if (tunnel) {
            logger.info('🔌 Stopping LocalTunnel...');
            tunnel.close();
            tunnel = null;
            tunnelUrl = null;
            logger.info('✅ LocalTunnel stopped');
        }
    } catch (error) {
        logger.error('Failed to stop tunnel:', error);
    }
}

/**
 * Get the current tunnel URL
 * @returns {string|null} Current tunnel URL or null
 */
function getTunnelUrl() {
    return tunnelUrl;
}

/**
 * Check if tunnel is active
 * @returns {boolean}
 */
function isTunnelActive() {
    return tunnel !== null && tunnelUrl !== null;
}

module.exports = {
    startTunnel,
    stopTunnel,
    getTunnelUrl,
    isTunnelActive
};
