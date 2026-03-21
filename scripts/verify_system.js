const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Correct DB path
const API_URL = 'http://localhost:3000/api';
const DB_PATH = path.join(__dirname, '../database.sqlite');

const db = new sqlite3.Database(DB_PATH);

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const testData = {
    name: `Test Campaign ${Date.now()}`,
    templateName: 'hello_world',
    contacts: [
        { phone: '1234567890', email: 'test@example.com' },
        { phone: '0987654321', email: 'test2@example.com' }
    ],
    scheduledAt: null
};

async function verifySystem() {
    console.log('[START] Starting System Verification...');
    let hasError = false;

    // 1. Test Scheduled Campaign
    console.log('[STEP 1] Testing SCHEDULED Campaign...');
    try {
        const scheduledTime = new Date(Date.now() + 3600000).toISOString(); // +1 hour
        const payload = { ...testData, name: 'Scheduled Test', scheduledAt: scheduledTime };

        const res = await axios.post(`${API_URL}/campaigns`, payload);
        const campaignId = res.data.campaignId;
        console.log(`   [INFO] Created Campaign ID: ${campaignId}`);

        // Wait to ensure worker has a chance to run (but shouldn't pick it up)
        await sleep(3000);

        // Check DB
        const messages = await runQuery('SELECT status FROM messages WHERE campaign_id = ?', [campaignId]);
        const statuses = messages.map(m => m.status);

        const allQueued = statuses.every(s => s === 'queued');
        const campaign = await runQuery('SELECT scheduled_at FROM campaigns WHERE id = ?', [campaignId]);
        const dbScheduledAt = campaign[0].scheduled_at;

        if (allQueued && dbScheduledAt) {
            console.log('   [PASS] Messages remained in "queued" state.');
            console.log(`   [PASS] scheduled_at saved as ${dbScheduledAt}`);
        } else {
            console.error('   [FAIL] Messages were processed or schedule missing!', statuses);
            hasError = true;
        }

    } catch (err) {
        console.error('   [ERROR] Step 1 Failed:', err.message);
        hasError = true;
    }

    console.log('\n--------------------------------------------------\n');

    // 2. Test Immediate Campaign
    console.log('[STEP 2] Testing IMMEDIATE Campaign...');
    try {
        const payload = { ...testData, name: 'Immediate Test', scheduledAt: null };
        const res = await axios.post(`${API_URL}/campaigns`, payload);
        const campaignId = res.data.campaignId;
        console.log(`   [INFO] Created Campaign ID: ${campaignId}`);

        // Wait for worker to process
        console.log('   [WAIT] Waiting 5s for worker...');
        await sleep(5000);

        // Check DB
        const messages = await runQuery('SELECT status FROM messages WHERE campaign_id = ?', [campaignId]);
        const statuses = messages.map(m => m.status);

        const touched = statuses.some(s => ['processing', 'sent', 'failed'].includes(s));

        if (touched) {
            console.log(`   [PASS] Worker picked up messages. Statuses: ${[...new Set(statuses)].join(', ')}`);
        } else {
            console.error('   [FAIL] Messages are still all queued!', statuses);

            // Debug failure
            const campaignDebug = await runQuery('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
            console.error('   [DEBUG] Campaign Row:', campaignDebug[0]);

            const msgDebug = await runQuery('SELECT * FROM messages WHERE campaign_id = ? LIMIT 1', [campaignId]);
            console.error('   [DEBUG] Message Row:', msgDebug[0]);

            hasError = true;
        }

    } catch (err) {
        console.error('   [ERROR] Step 2 Failed:', err.message);
        hasError = true;
    }

    console.log('\n--------------------------------------------------\n');

    // 3. Test Analytics API
    console.log('[STEP 3] Testing Analytics API...');
    try {
        const res = await axios.get(`${API_URL}/stats/dashboard`);
        if (typeof res.data.total_campaigns === 'number' && typeof res.data.total_sent === 'number') {
            console.log('   [PASS] API responded with valid stats structure.');
            console.log(`   [INFO] Current Stats: ${JSON.stringify(res.data)}`);
        } else {
            console.error('   [FAIL] Invalid stats response:', JSON.stringify(res.data));
            hasError = true;
        }
    } catch (err) {
        console.error('   [ERROR] Step 3 Failed:', err.message);
        hasError = true;
    }

    console.log('\n--------------------------------------------------\n');

    if (hasError) console.log('[RESULT] Verification Completed with ERRORS.');
    else console.log('[RESULT] Verification PASSED Successfully!');
    process.exit(hasError ? 1 : 0);
}

verifySystem();
