/**
 * @file tunnelManager.js
 * @description LocalTunnel wrapper that exposes the local Express server to the
 *              internet so Meta can deliver webhook events to this machine.
 *              Manages tunnel lifecycle: start, stop, and URL retrieval.
 * @module backend/tunnelManager
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const localtunnel = require('localtunnel');
const logger = require('./utils/logger');

let tunnel = null;
let tunnelUrl = null;

/**
 * @function startTunnel
 * @description Starts a LocalTunnel session and binds it to the given local port.
 *              Registers error and close event handlers for resilience.
 * @param {number} [port=3000] - Local port to tunnel.
 * @param {string} [subdomain='whatsflow'] - Requested tunnel subdomain.
 * @returns {Promise<string>} The public HTTPS tunnel URL.
 * @throws {Error} If the tunnel fails to connect (e.g., subdomain taken).
 */
async function startTunnel(port = 3000, subdomain = 'whatsflow') {
    try {
        logger.info('Starting LocalTunnel...');

        tunnel = await localtunnel({
            port: port,
            subdomain: subdomain
        });

        tunnelUrl = tunnel.url;

        logger.info('LocalTunnel started successfully');
        logger.info(`Public Webhook URL: ${tunnelUrl}/webhook`);
        logger.info(`Forwarding to: http://localhost:${port}`);

        // Handle tunnel errors
        tunnel.on('error', (err) => {
            logger.error('LocalTunnel error:', err);
        });

        tunnel.on('close', () => {
            logger.warn('LocalTunnel closed');
            tunnelUrl = null;
        });

        return tunnelUrl;
    } catch (error) {
        logger.error('Failed to start LocalTunnel:', error.message);
        if (error.message.includes('subdomain')) {
            logger.error('Subdomain may be taken — configure TUNNEL_SUBDOMAIN in .env');
        }
        throw error;
    }
}

/**
 * @function stopTunnel
 * @description Gracefully closes the active LocalTunnel connection and
 *              resets internal state variables.
 * @returns {Promise<void>}
 */
async function stopTunnel() {
    try {
        if (tunnel) {
            logger.info('Stopping LocalTunnel...');
            tunnel.close();
            tunnel = null;
            tunnelUrl = null;
            logger.info('LocalTunnel stopped');
        }
    } catch (error) {
        logger.error('Failed to stop tunnel:', error);
    }
}

/**
 * @function getTunnelUrl
 * @description Returns the active public tunnel base URL, or null if not started.
 * @returns {string|null} The tunnel URL (e.g. https://abc.loca.lt) or null.
 */
function getTunnelUrl() {
    return tunnelUrl;
}

/**
 * @function isTunnelActive
 * @description Checks whether the tunnel connection is currently active.
 * @returns {boolean} True if tunnel is running and URL is available.
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
