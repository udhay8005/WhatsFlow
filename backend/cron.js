const cron = require('node-cron');
const db = require('./database');
const logger = require('./utils/logger');

// Schedule tasks
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
