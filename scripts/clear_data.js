const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Clearing data from:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

const tablesToClear = ['messages', 'campaigns', 'contacts'];

db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    tablesToClear.forEach(table => {
        db.run(`DELETE FROM ${table}`, (err) => {
            if (err) {
                console.error(`Error clearing table ${table}:`, err.message);
                db.run("ROLLBACK");
                process.exit(1);
            } else {
                console.log(`Cleared table: ${table}`);
            }
        });

        // Reset Auto Increment
        db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`, (err) => {
            if (err) console.warn(`Could not reset sequence for ${table}:`, err.message);
        });
    });

    db.run("COMMIT", (err) => {
        if (err) {
            console.error('Error committing transaction:', err.message);
            process.exit(1);
        } else {
            console.log('All test data cleared successfully!');
            console.log('Settings (app_config) were PRESERVED.');
            db.close();
        }
    });
});
