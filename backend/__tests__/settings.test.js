const request = require('supertest');
const express = require('express');
const settingsRouter = require('../routes/settings');

// Mock database
jest.mock('../database', () => ({
    run: jest.fn((sql, params, callback) => {
        if (callback) callback(null);
    }),
    get: jest.fn((sql, params, callback) => {
        callback(null, null);
    }),
    all: jest.fn((sql, params, callback) => {
        callback(null, [
            { key: 'wa_access_token', value: 'encrypted_token' },
            { key: 'wa_phone_id', value: 'encrypted_phone_id' }
        ]);
    }),
}));

describe('Settings API Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/settings', settingsRouter);
    });

    describe('GET /api/settings/config', () => {
        it('should return configuration status', async () => {
            const response = await request(app)
                .get('/api/settings/config')
                .expect(200);

            expect(response.body).toHaveProperty('configured');
            expect(response.body.configured).toHaveProperty('wa_access_token');
            expect(response.body.configured).toHaveProperty('wa_phone_id');
            expect(response.body.configured).toHaveProperty('wa_waba_id');
        });
    });

    describe('POST /api/settings/config', () => {
        it.skip('should save valid configuration (requires real DB)', async () => {
            // Skipped: Integration test requires actual database with transaction support
            // Manual testing required with real app
            const config = {
                wa_access_token: 'test_token',
                wa_phone_id: '123456789',
            };

            const response = await request(app)
                .post('/api/settings/config')
                .send(config)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Settings saved');
        });

        it('should reject invalid keys', async () => {
            const config = {
                invalid_key: 'value',
            };

            const response = await request(app)
                .post('/api/settings/config')
                .send(config)
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject empty payload', async () => {
            const response = await request(app)
                .post('/api/settings/config')
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });
});
