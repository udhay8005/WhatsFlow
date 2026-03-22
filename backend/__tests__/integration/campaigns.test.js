const request = require('supertest');
const { app, server } = require('../../server');
const db = require('../../database');
const { getApiKey } = require('../../middleware/auth');

// Mock external services to prevent real calls during API tests
jest.mock('../../services/whatsappService');
jest.mock('../../services/emailService');
jest.mock('../../worker', () => ({
    startWorker: jest.fn(),
    stopWorker: jest.fn() // mock export
}));

describe('Campaigns API', () => {
    let apiKey;

    // Clean up DB before running
    beforeAll(done => {
        // Get the session API key generated at startup
        apiKey = getApiKey();

        // Wait for connection/schema init
        setTimeout(() => {
            db.run("DELETE FROM campaigns", [], (err) => {
                done();
            });
        }, 1000);
    });

    afterAll(done => {
        server.close(() => {
            // Force close DB
            db.close(() => {
                done();
            });
        });
    });

    it('should create a new campaign', async () => {
        const payload = {
            name: "Integration Test Campaign",
            templateName: "hello_world",
            contacts: [
                { phone: "+1234567890", name: "Test User" }
            ]
        };

        const res = await request(app)
            .post('/api/campaigns')
            .set('X-API-Key', apiKey)
            .send(payload);

        if (res.status !== 201) {
            console.error('Campaign creation failed:', JSON.stringify(res.body, null, 2));
        }

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('campaignId');
        expect(res.body).toHaveProperty('message', 'Campaign created with 1 messages.');
    });

    it('should validate missing fields', async () => {
        const res = await request(app)
            .post('/api/campaigns')
            .set('X-API-Key', apiKey)
            .send({ name: "Invalid" }); // Missing contacts/template

        expect(res.status).toBe(400);
    });
});
