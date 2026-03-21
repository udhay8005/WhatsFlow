const sqlite3 = require('sqlite3').verbose();
const path = require('path');
// Correct path: from scripts/ (__) -> up to root -> database.sqlite
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log(`Checking DB at: ${dbPath}`);

db.all("PRAGMA table_info(campaigns)", [], (err, rows) => {
    if (err) console.error(err);
    else {
        const hasScheduled = rows.some(r => r.name === 'scheduled_at');
        console.log(`Has scheduled_at: ${hasScheduled}`);
        console.log('Columns:', rows.map(r => r.name));
    }
});
