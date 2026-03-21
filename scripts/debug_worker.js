const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../backend/database.sqlite'));

const sql = `
    SELECT m.id, m.status, c.status as campaign_status, c.scheduled_at, datetime('now', 'localtime') as now_local
    FROM messages m
    JOIN campaigns c ON m.campaign_id = c.id
    WHERE m.status IN ('queued', 'processing')
    LIMIT 5
`;

db.all(sql, [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
});
