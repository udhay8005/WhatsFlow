const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Optimizing database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log('Adding index to scheduled_at column...');

    // Add index for better performance of worker queries
    db.run("CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at)", (err) => {
        if (err) {
            console.error('Failed to create index:', err.message);
            process.exit(1);
        } else {
            console.log('✓ Index idx_campaigns_scheduled created successfully');
            db.close();
        }
    });
});
