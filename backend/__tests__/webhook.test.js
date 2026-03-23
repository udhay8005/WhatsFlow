const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const webhookRouter = require('../routes/webhook');
const { errorHandler } = require('../middleware/errorHandler');

// Mock dependencies
jest.mock('../database', () => ({
    get: jest.fn(),
    run: jest.fn(),
}));

jest.mock('../services/cryptoService', () => ({
    decrypt: jest.fn((val) => val), // Simple pass-through for testing
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const db = require('../database');
const cryptoService = require('../services/cryptoService');

describe('Webhook Routes', () => {
    let app;
    let mockIo;

    beforeAll(() => {
        app = express();
        // Do NOT add a global express.json() before the webhook router.
        // In production (server.js) the global JSON parser is explicitly skipped
        // for /webhook paths so the router's own parser — which has the verify
        // callback that captures req.rawBody — always runs first.
        // Replicating that here ensures req.rawBody is populated and the HMAC
        // check can validate against the exact bytes sent by the client.
        mockIo = { emit: jest.fn() };
        app.set('io', mockIo);
        app.use('/webhook', webhookRouter);
        app.use(errorHandler); // Catch asyncHandler forwarded errors
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Helper: generate HMAC-SHA256 signature over a JSON body
    const generateSignature = (body, secret) => {
        return 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    };

    describe('GET /webhook (Verification)', () => {
        it('should return 400 if params are missing', async () => {
            await request(app).get('/webhook').expect(400);
        });

        it('should verify token and return challenge', async () => {
            // Mock DB to return verify token
            db.get.mockImplementation((sql, cb) => {
                if (sql.includes('webhook_verify_token')) {
                    cb(null, { value: 'my_verify_token' });
                }
            });

            const response = await request(app)
                .get('/webhook')
                .query({
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'my_verify_token',
                    'hub.challenge': '12345'
                })
                .expect(200);

            expect(response.text).toBe('12345');
        });

        it('should reject invalid verify token', async () => {
            db.get.mockImplementation((sql, cb) => {
                if (sql.includes('webhook_verify_token')) {
                    cb(null, { value: 'my_verify_token' });
                }
            });

            await request(app)
                .get('/webhook')
                .query({
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'wrong_token',
                    'hub.challenge': '12345'
                })
                .expect(403);
        });
    });

    describe('POST /webhook (Events)', () => {
        const payload = { object: 'whatsapp_business_account', entry: [] };
        const appSecret = 'my_app_secret';

        it('should accept valid signature', async () => {
            db.get.mockImplementation((sql, cb) => {
                if (sql.includes('wa_app_secret')) {
                    cb(null, { value: appSecret });
                }
            });

            const signature = generateSignature(payload, appSecret);

            await request(app)
                .post('/webhook')
                .set('x-hub-signature-256', signature)
                .send(payload)
                .expect(200);
        });

        it('should reject invalid signature', async () => {
            db.get.mockImplementation((sql, cb) => {
                if (sql.includes('wa_app_secret')) {
                    cb(null, { value: appSecret });
                }
            });

            const signature = generateSignature(payload, 'wrong_secret');

            await request(app)
                .post('/webhook')
                .set('x-hub-signature-256', signature)
                .send(payload)
                .expect(403);
        });

        it('should reject when no app secret is configured', async () => {
            // Mock DB returning no secret
            db.get.mockImplementation((sql, cb) => {
                if (sql.includes('wa_app_secret')) {
                    cb(null, undefined); // No row
                }
            });

            await request(app)
                .post('/webhook')
                .send(payload)
                .expect(403);
        });

        it('should process status updates', async () => {
            const updatePayload = {
                object: 'whatsapp_business_account',
                entry: [{
                    changes: [{
                        value: {
                            statuses: [{
                                id: 'wamid.HBgLM...',
                                status: 'sent',
                                timestamp: '1234567890'
                            }]
                        }
                    }]
                }]
            };

            // Provide a valid app secret and signature so the HMAC check passes
            db.get.mockImplementation((sql, cb) => {
                if (sql.includes('wa_app_secret')) {
                    cb(null, { value: appSecret });
                }
            });

            const signature = generateSignature(updatePayload, appSecret);

            // Mock successful DB update
            db.run.mockImplementation((sql, params, cb) => cb(null));

            await request(app)
                .post('/webhook')
                .set('x-hub-signature-256', signature)
                .send(updatePayload)
                .expect(200);

            // Verify DB update called
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE messages SET status'),
                expect.arrayContaining(['sent', 'wamid.HBgLM...']),
                expect.any(Function)
            );

            // Verify Socket emit called
            // Note: since db.run mock calls cb immediately, emit should happen
            expect(mockIo.emit).toHaveBeenCalledWith('status_update', { id: 'wamid.HBgLM...', status: 'sent' });
        });
    });
});
