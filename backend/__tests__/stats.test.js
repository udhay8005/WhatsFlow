const request = require('supertest');
const express = require('express');
const statsRouter = require('../routes/stats');

// Mock dependencies
jest.mock('../database', () => ({
    get: jest.fn(),
    all: jest.fn(),
}));

const db = require('../database');

describe('Stats Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/stats', statsRouter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/stats/dashboard', () => {
        it('should return aggregated dashboard stats', async () => {
            const mockData = {
                total_campaigns: 5,
                total_sent: 100,
                total_failed: 2,
                total_pending: 10
            };

            db.get.mockImplementation((sql, params, cb) => {
                cb(null, mockData);
            });

            const response = await request(app)
                .get('/api/stats/dashboard')
                .expect(200);

            expect(response.body).toEqual(mockData);
        });

        it('should handle database errors', async () => {
            db.get.mockImplementation((sql, params, cb) => {
                cb(new Error('DB Error'));
            });

            await request(app)
                .get('/api/stats/dashboard')
                .expect(500);
        });
    });

    describe('GET /api/stats/trend', () => {
        it('should return trend data with filled missing days', async () => {
            const today = new Date().toISOString().split('T')[0];
            const mockRows = [
                { date: today, count: 50 }
            ];

            db.all.mockImplementation((sql, params, cb) => {
                cb(null, mockRows);
            });

            const response = await request(app)
                .get('/api/stats/trend')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(7); // Last 7 days

            // Check if today matches
            const lastDay = response.body[6];
            expect(lastDay.date).toBe(today);
            expect(lastDay.count).toBe(50);

            // Check if other days are zero
            const previousDay = response.body[5];
            expect(previousDay.count).toBe(0);
        });

        it('should handle database errors', async () => {
            db.all.mockImplementation((sql, params, cb) => {
                cb(new Error('DB Error'));
            });

            await request(app)
                .get('/api/stats/trend')
                .expect(500);
        });
    });

    describe('GET /api/stats/status-distribution', () => {
        it('should return status distribution', async () => {
            const mockRows = [
                { status: 'sent', count: 80 },
                { status: 'failed', count: 20 }
            ];

            db.all.mockImplementation((sql, params, cb) => {
                cb(null, mockRows);
            });

            const response = await request(app)
                .get('/api/stats/status-distribution')
                .expect(200);

            expect(response.body).toEqual(mockRows);
        });

        it('should handle database errors', async () => {
            db.all.mockImplementation((sql, params, cb) => {
                cb(new Error('DB Error'));
            });

            await request(app)
                .get('/api/stats/status-distribution')
                .expect(500);
        });
    });
});
