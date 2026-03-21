const request = require('supertest');
const express = require('express');
const campaignsRouter = require('../routes/campaigns');

// Mock database
jest.mock('../database', () => ({
    serialize: jest.fn((callback) => callback()),
    run: jest.fn((sql, params, callback) => {
        if (typeof callback === 'function') {
            callback.call({ lastID: 1 }, null);
        }
    }),
    get: jest.fn((sql, params, callback) => {
        callback(null, {
            id: 1,
            name: 'Test Campaign',
            template_name: 'hello_world',
            status: 'active',
            total_count: 10,
            success_count: 0,
            failed_count: 0,
        });
    }),
    all: jest.fn((sql, params, callback) => {
        callback(null, [
            { id: 1, name: 'Campaign 1', template_name: 'hello_world', status: 'active' },
        ]);
    }),
}));

// Mock WhatsApp service
jest.mock('../services/whatsappService', () => ({
    getTemplates: jest.fn().mockResolvedValue([
        { name: 'hello_world', status: 'APPROVED', language: 'en' },
    ]),
}));

describe('Campaigns API Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.set('io', { emit: jest.fn() }); // Mock Socket.IO
        app.use('/api/campaigns', campaignsRouter);
    });

    afterAll(() => {
        // Clean up any timers or async operations
        jest.clearAllTimers();
    });

    describe('GET /api/campaigns', () => {
        it('should return list of campaigns', async () => {
            const response = await request(app)
                .get('/api/campaigns')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/campaigns/templates', () => {
        it('should return templates from WhatsApp API', async () => {
            const response = await request(app)
                .get('/api/campaigns/templates')
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('POST /api/campaigns', () => {
        it.skip('should create campaign with valid data (requires real DB)', async () => {
            // Skipped: Integration test requires actual database with transactions
            // Manual testing required with real app
            const campaignData = {
                name: 'Test Campaign',
                templateName: 'hello_world',
                contacts: [
                    { phone: '919876543210', email: 'test@example.com', params: ['Name'] },
                ],
            };

            const response = await request(app)
                .post('/api/campaigns')
                .send(campaignData)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Campaign created');
        });

        it('should reject campaign with missing name', async () => {
            const campaignData = {
                templateName: 'hello_world',
                contacts: [{ phone: '919876543210' }],
            };

            const response = await request(app)
                .post('/api/campaigns')
                .send(campaignData)
                .expect(400);

            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors[0].msg).toBe('Campaign name is required');
        });

        it('should reject campaign with no contacts', async () => {
            const campaignData = {
                name: 'Test Campaign',
                templateName: 'hello_world',
                contacts: [],
            };

            const response = await request(app)
                .post('/api/campaigns')
                .send(campaignData)
                .expect(400);

            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors[0].msg).toContain('Contacts must be a non-empty array');
        });

        it('should reject campaign with invalid phone numbers', async () => {
            const campaignData = {
                name: 'Test Campaign',
                templateName: 'hello_world',
                contacts: [{ phone: 'invalid' }],
            };

            const response = await request(app)
                .post('/api/campaigns')
                .send(campaignData)
                .expect(400);

            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors[0].msg).toContain('Phone number must be in E.164 format (e.g. +1234567890)');
        });
    });
});
