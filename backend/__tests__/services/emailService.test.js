const emailService = require('../../services/emailService');
const nodemailer = require('nodemailer');
const db = require('../../database');
const cryptoService = require('../../services/cryptoService');

jest.mock('nodemailer');
jest.mock('../../database', () => ({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
}));
jest.mock('../../services/cryptoService');
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

describe('Email Service', () => {
    let mockTransporter;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'email_123' })
        };
        nodemailer.createTransport.mockReturnValue(mockTransporter);

        // Mock Crypto
        cryptoService.decrypt.mockImplementation(val => val.replace('enc_', 'text_'));
    });

    it('should send fallback email when configured', async () => {
        // Mock DB Config
        db.all.mockImplementation((query, params, cb) => {
            cb(null, [
                { key: 'smtp_host', value: 'smtp.test.com' },
                { key: 'smtp_port', value: '587' },
                { key: 'smtp_user', value: 'user@test.com' },
                { key: 'smtp_pass', value: 'enc_pass' },
                { key: 'smtp_secure', value: 'true' }
            ]);
        });

        const msgId = await emailService.sendFallbackEmail('recipient@test.com', 'Body Text');

        expect(msgId).toBe('email_123');
        expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: 'smtp.test.com',
            auth: { user: 'user@test.com', pass: 'text_pass' }
        }));
        expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'recipient@test.com',
            text: 'Body Text'
        }));
    });

    it('should return false if SMTP not configured', async () => {
        db.all.mockImplementation((query, params, cb) => {
            cb(null, []); // Empty config
        });

        const result = await emailService.sendFallbackEmail('recipient@test.com', 'Body Text');
        expect(result).toBe(false);
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should handled send errors', async () => {
        db.all.mockImplementation((query, params, cb) => {
            cb(null, [
                { key: 'smtp_host', value: 'smtp.test.com' },
                { key: 'smtp_port', value: '587' },
                { key: 'smtp_user', value: 'user@test.com' },
                { key: 'smtp_pass', value: 'enc_pass' }
            ]);
        });
        mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

        const result = await emailService.sendFallbackEmail('recipient@test.com', 'Body Text');

        expect(result).toBeNull();
    });
});
