/**
 * @file database.js
 * @description SQLite database connection and schema initialization.
 *              Enables WAL mode for concurrent read performance.
 *              Auto-migrates missing columns on startup.
 * @module backend/database
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./utils/logger');

// Determine database path.
// In production the Electron main process sets WHATSFLOW_USER_DATA to
// app.getPath('userData') (e.g. C:\Users\<user>\AppData\Roaming\WhatsFlow).
// This keeps the database out of the read-only installation directory and
// prevents SQLITE_READONLY / SQLITE_CANTOPEN errors on Windows.
const dbDir = process.env.WHATSFLOW_USER_DATA || path.resolve(__dirname, '..');
const dbPath = process.env.NODE_ENV === 'test'
    ? path.resolve(__dirname, '../database.test.sqlite')
    : path.join(dbDir, 'database.sqlite');
logger.info('Connecting to database at ' + dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('DB connection error:', err.message);
        process.exit(1); // Fatal error
    } else {
        logger.info('Connected to SQLite database (reader)');
        // Enable WAL mode for better concurrent performance
        db.run('PRAGMA journal_mode = WAL', (err) => {
            if (err) logger.error('WAL enable failed:', err);
            else logger.info('WAL mode enabled');
        });
        // Enforce foreign key constraints (SQLite disables them by default).
        // Must be set per-connection — required for ON DELETE CASCADE to work.
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) logger.error('Foreign key enforcement failed:', err);
            else logger.info('Foreign key enforcement enabled');
        });
        // Wait up to 5s for write locks instead of failing immediately with
        // SQLITE_BUSY when the dbWriter connection holds a transaction lock.
        db.run('PRAGMA busy_timeout = 5000');
        initializeSchema();
    }
});

// Dedicated writer connection for multi-statement transactions (BEGIN/COMMIT).
// The main `db` connection is shared by the whole app for reads and lightweight
// single-statement writes (worker status updates, blacklist inserts, etc.).
//
// Without a separate connection, an async transaction that yields the event loop
// (await in a for-loop) lets queries from other code paths (worker.js, stats)
// execute inside the open transaction on the shared connection. If that
// transaction rolls back, the unrelated writes are silently reverted — e.g. a
// message marked 'sent' by the worker is rolled back to 'queued', causing a
// duplicate WhatsApp send on the next poll cycle.
const dbWriter = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('Writer DB connection error:', err.message);
    } else {
        logger.info('Connected to SQLite database (writer)');
        dbWriter.run('PRAGMA journal_mode = WAL');
        dbWriter.run('PRAGMA foreign_keys = ON');
        dbWriter.run('PRAGMA busy_timeout = 5000');
    }
});

/**
 * @function initializeSchema
 * @description Creates all database tables if they do not exist and runs
 *              auto-migration ALTER statements for backward compatibility.
 * @returns {void}
 */
function initializeSchema() {
    db.serialize(() => {
        // App Config
        db.run(`CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Contacts
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT UNIQUE NOT NULL,
            name TEXT,
            email TEXT,
            status TEXT DEFAULT 'active',
            email_opt_in BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Blacklist
        db.run(`CREATE TABLE IF NOT EXISTS blacklist (
            phone_number TEXT PRIMARY KEY,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Campaigns
        db.run(`CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            template_name TEXT NOT NULL,
            template_language TEXT DEFAULT 'en_US',
            status TEXT DEFAULT 'draft',
            total_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            media_id TEXT,
            media_type TEXT,
            scheduled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                // Auto-migrations for existing databases
                const migrations = [
                    "ALTER TABLE campaigns ADD COLUMN scheduled_at DATETIME",
                    "ALTER TABLE campaigns ADD COLUMN media_id TEXT",
                    "ALTER TABLE campaigns ADD COLUMN media_type TEXT",
                    "ALTER TABLE campaigns ADD COLUMN template_language TEXT DEFAULT 'en_US'"
                ];
                migrations.forEach(sql => {
                    db.run(sql, (err) => {
                        if (err && !err.message.includes("duplicate column")) {
                            logger.error('Migration error:', err.message);
                        }
                    });
                });
            }
        });

        // Messages
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            contact_id INTEGER,
            phone_number TEXT NOT NULL,
            wa_message_id TEXT,
            status TEXT DEFAULT 'queued',
            error_reason TEXT,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 2,
            fallback_attempted BOOLEAN DEFAULT 0,
            final_channel TEXT DEFAULT 'whatsapp',
            variable_data TEXT,
            sent_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE SET NULL
        )`);

        // Indexes for performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_wamid ON messages(wa_message_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number)`);

        // Critical indexes for worker performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_status_campaign ON messages(status, campaign_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`);

        logger.info('Schema initialized');
    });
}

// Graceful shutdown — close writer first (it may hold an active transaction),
// then the reader, then exit.
process.on('SIGINT', () => {
    dbWriter.close((err) => {
        if (err) logger.error('Error closing writer connection:', err);
        db.close((err2) => {
            if (err2) logger.error('Error closing reader connection:', err2);
            else logger.info('Database connections closed');
            process.exit(0);
        });
    });
});

module.exports = db;
module.exports.dbWriter = dbWriter;
