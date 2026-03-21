/**
 * @file cron.js
 * @description Scheduled background jobs for database maintenance.
 *              Currently runs a nightly SQLite VACUUM at 03:00 AM to reclaim
 *              unused disk space and keep the database file compact.
 * @module backend/cron
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

const cron = require('node-cron');
const db = require('./database');
const logger = require('./utils/logger');

/**
 * @function startCronJobs
 * @description Registers all scheduled cron tasks. Call once on server startup.
 *              Current jobs: VACUUM at 03:00 AM daily.
 * @returns {void}
 */
function startCronJobs() {
    // Run Database VACUUM every night at 3:00 AM
    // This reclaims unused space and optimizes the database file
    cron.schedule('0 3 * * *', () => {
        logger.info('Starting nightly database maintenance (VACUUM)...');
        db.run('VACUUM', (err) => {
            if (err) logger.error('Database VACUUM failed:', err);
            else logger.info('Database VACUUM completed successfully');
        });
    });

    logger.info('Cron jobs scheduled');
}

module.exports = { startCronJobs };
