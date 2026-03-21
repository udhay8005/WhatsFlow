const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../backend/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log(`Migrating DB at: ${dbPath}`);

db.serialize(() => {
    // 1. Check Tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
        if (err) console.error("List tables error:", err);
        else console.log("Tables:", rows);
    });

    // 2. Add scheduled_at column
    // SQLite doesn't support IF NOT EXISTS for ADD COLUMN deeply, so we wrap in try/catch equivalent or just run it and ignore error.
    const addColumn = (table, colParams) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${colParams}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column already exists: ${table}.${colParams.split(' ')[0]}`);
                } else {
                    console.error(`Error adding column to ${table}:`, err.message);
                }
            } else {
                console.log(`Added column to ${table}: ${colParams}`);
            }
        });
    };

    addColumn('campaigns', 'scheduled_at TEXT');
    addColumn('campaigns', 'media_id TEXT');
    addColumn('campaigns', 'media_type TEXT');
});

db.close();
