const request = require('supertest');
const express = require('express');
const contactsRouter = require('../routes/contacts');

// Mock Dependencies
jest.mock('../database', () => {
    return {
        serialize: jest.fn(cb => cb()),
        run: jest.fn((sql, params, cb) => {
            if (cb) cb(null);
        }),
        all: jest.fn((sql, params, cb) => {
            // Mock Responses based on query content
            if (sql.includes('SELECT * FROM blacklist')) {
                cb(null, [{ phone_number: '+1234567890', reason: 'Spam' }]);
            } else if (sql.includes('FROM blacklist WHERE phone_number IN')) {
                // Check if input params contains blocked number
                if (params && params.includes('+919999999999')) {
                    cb(null, [{ phone_number: '+919999999999', reason: 'Blocked' }]);
                } else {
                    cb(null, []);
                }
            } else if (sql.includes('FROM messages')) {
                // Frequency Check
                if (params && params.includes('+918888888888')) {
                    cb(null, [{ phone_number: '+918888888888', last_sent: '2023-01-01' }]);
                } else {
                    cb(null, []);
                }
            } else {
                cb(null, []);
            }
        })
    };
});

describe('Contact Safety Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/contacts', contactsRouter);
    });

    describe('POST /api/contacts/blacklist', () => {
        it('should add a phone number to blacklist', async () => {
            const res = await request(app)
                .post('/api/contacts/blacklist')
                .send({ phone: '+1234567890', reason: 'Spam' })
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/contacts/check-eligibility', () => {
        it('should identify blacklisted numbers', async () => {
            const res = await request(app)
                .post('/api/contacts/check-eligibility')
                .send({ contacts: [{ phone: '+919999999999' }, { phone: '+123' }] })
                .expect(200);

            expect(res.body.blacklisted).toHaveLength(1);
            expect(res.body.blacklisted[0].phone).toBe('+919999999999');
        });

        it('should identify frequency limited numbers', async () => {
            const res = await request(app)
                .post('/api/contacts/check-eligibility')
                .send({ contacts: [{ phone: '+918888888888' }] })
                .expect(200);

            expect(res.body.limited).toHaveLength(1);
            expect(res.body.limited[0].phone).toBe('+918888888888');
        });
    });
});
