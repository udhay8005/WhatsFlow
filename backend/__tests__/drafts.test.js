const request = require('supertest');
const express = require('express');
const campaignsRouter = require('../routes/campaigns');
const { validateCampaignCreation } = require('../middleware/validators');
const { errorHandler } = require('../middleware/errorHandler');

// Mock Dependencies
jest.mock('../database', () => {
    // Helper: create a set of mock db methods for a connection
    const makeMethods = () => ({
        run: jest.fn(function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback.call({ lastID: 100, changes: 1 }, null);
        }),
        get: jest.fn((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, { id: 1 });
        }),
        all: jest.fn(),
    });
    const mockDb = {
        serialize: jest.fn(cb => cb()),
        ...makeMethods(),
    };
    // campaigns.js reads db.dbWriter at module scope for its transaction connection
    mockDb.dbWriter = makeMethods();
    return mockDb;
});

jest.mock('../services/whatsappService', () => ({
    getTemplates: jest.fn(),
}));

describe('Draft Campaigns Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.set('io', { emit: jest.fn() });
        // validators need to be mocked or used? We want to test VALIDATION logic.
        // So we should use the REAL router which uses REAL validators.
        app.use('/api/campaigns', campaignsRouter);
        app.use(errorHandler); // Catch asyncHandler forwarded errors
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/campaigns (Create)', () => {
        it('should allow saving DRAFT with minimal data (Name only)', async () => {
            const res = await request(app)
                .post('/api/campaigns')
                .send({
                    name: 'My Draft',
                    status: 'draft',
                    // Missing template/contacts
                })
                .expect(201); // Created

            expect(res.body.success).toBe(true);
        });

        it('should REJECT active campaign with missing data', async () => {
            const res = await request(app)
                .post('/api/campaigns')
                .send({
                    name: 'Bad Active',
                    status: 'active'
                    // Missing template/contacts
                })
                .expect(400); // Bad Request

            expect(res.body.errors).toBeDefined();
        });
    });

    describe('PUT /api/campaigns/:id (Update)', () => {
        it('should allow updating a DRAFT', async () => {
            const res = await request(app)
                .put('/api/campaigns/1')
                .send({
                    name: 'Updated Draft',
                    status: 'draft',
                    contacts: [{ phone: '+1234567890' }]
                })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should allow publishing a DRAFT to ACTIVE if valid', async () => {
            const res = await request(app)
                .put('/api/campaigns/1')
                .send({
                    name: 'Publishing Draft',
                    status: 'active',
                    templateName: 'hello_world',
                    contacts: [{ phone: '+1234567890' }]
                })
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });
});
