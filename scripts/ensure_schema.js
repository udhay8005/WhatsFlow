const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Running database migration on:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log('Checking schema...');

    // Check if scheduled_at exists
    db.all("PRAGMA table_info(campaigns)", [], (err, columns) => {
        if (err) {
            console.error('Error checking schema:', err.message);
            process.exit(1);
        }

        const hasScheduledAt = columns.some(col => col.name === 'scheduled_at');
        const hasMediaId = columns.some(col => col.name === 'media_id');
        const hasMediaType = columns.some(col => col.name === 'media_type');

        console.log('Schema check results:');
        console.log('  - scheduled_at:', hasScheduledAt ? '✓ EXISTS' : '✗ MISSING');
        console.log('  - media_id:', hasMediaId ? '✓ EXISTS' : '✗ MISSING');
        console.log('  - media_type:', hasMediaType ? '✓ EXISTS' : '✗ MISSING');

        let needsMigration = false;

        db.run("BEGIN TRANSACTION");

        // Add scheduled_at if missing
        if (!hasScheduledAt) {
            console.log('Adding scheduled_at column...');
            db.run("ALTER TABLE campaigns ADD COLUMN scheduled_at DATETIME", (err) => {
                if (err) {
                    console.error('Failed to add scheduled_at:', err.message);
                    db.run("ROLLBACK");
                    process.exit(1);
                } else {
                    console.log('✓ Added scheduled_at column');
                    needsMigration = true;
                }
            });
        }

        // Add media_id if missing
        if (!hasMediaId) {
            console.log('Adding media_id column...');
            db.run("ALTER TABLE campaigns ADD COLUMN media_id TEXT", (err) => {
                if (err) {
                    console.error('Failed to add media_id:', err.message);
                    db.run("ROLLBACK");
                    process.exit(1);
                } else {
                    console.log('✓ Added media_id column');
                    needsMigration = true;
                }
            });
        }

        // Add media_type if missing
        if (!hasMediaType) {
            console.log('Adding media_type column...');
            db.run("ALTER TABLE campaigns ADD COLUMN media_type TEXT", (err) => {
                if (err) {
                    console.error('Failed to add media_type:', err.message);
                    db.run("ROLLBACK");
                    process.exit(1);
                } else {
                    console.log('✓ Added media_type column');
                    needsMigration = true;
                }
            });
        }

        db.run("COMMIT", (err) => {
            if (err) {
                console.error('Failed to commit migration:', err.message);
                process.exit(1);
            } else {
                if (needsMigration) {
                    console.log('\n✅ Migration completed successfully!');
                } else {
                    console.log('\n✅ Schema is up to date, no migration needed!');
                }
                db.close();
            }
        });
    });
});
