const worker = require('../worker');
const db = require('../database');
const whatsappService = require('../services/whatsappService');
const emailService = require('../services/emailService');

jest.mock('../database', () => ({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn()
}));
jest.mock('../services/whatsappService');
jest.mock('../services/emailService');
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));
jest.mock('../services/cryptoService', () => ({
    decrypt: jest.fn(val => val)
}));

describe('Worker Queue', () => {
    let mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIo = { emit: jest.fn() };
        // Prevent infinite loops by mocking setTimeout to NOT run callback automatically
        // We will test single iteration logic
        global.setTimeout = jest.fn();
    });

    it('should process a queued message successfully', async () => {
        // 1. Mock Rate Limit
        db.get.mockImplementationOnce((query, cb) => cb(null, { value: '10' })); // Max TPS

        // 2. Mock Fetch Message
        const mockMsg = { id: 1, phone_number: '+1234567890', template_name: 'hello', status: 'queued', retry_count: 0, max_retries: 2 };
        db.get.mockImplementationOnce((query, params, cb) => cb(null, mockMsg));

        // 3. Mock Optimistic Lock (Update)
        // db.run for UPDATE returns this.changes = 1
        db.run.mockImplementationOnce((query, params, cb) => {
            // context 'this' needs to have changes property
            cb.call({ changes: 1 }, null);
        });

        // 4. Mock Success Update
        db.run.mockImplementationOnce((query, params, cb) => cb(null)); // status='processing' log
        // Note: logical flow: UPDATE (lock) -> proceedToSend -> ... 

        // Mock WhatsApp Success
        whatsappService.sendMessage.mockResolvedValue({ messages: [{ id: 'wamid.123' }] });

        // 5. Mock Final Status Update
        db.run.mockImplementationOnce((query, params, cb) => cb(null));

        // Start (fake start)
        const processQueue = worker.testableProcessQueue;
        // Logic inside is async but callback based on db.get. 
        // We need to trigger it.

        // Since processQueue is internal and not async-await at top level, 
        // testing it requires ensuring callbacks run. 
        // But our mocks are synchronous implementations here (calling cb immediately).

        // We set isRunning to true manually or call startWorker? 
        // processQueue checks isRunning.
        worker.startWorker(mockIo);

        // We assume startWorker calls processQueue once.
        // Because setTimeout is mocked and does nothing, strictly one iteration runs.

        // Allow microtasks to clear (for async sendMessage)
        await new Promise(resolve => process.nextTick(resolve));
        await new Promise(resolve => process.nextTick(resolve));

        expect(whatsappService.sendMessage).toHaveBeenCalledWith(
            '+1234567890', 'hello', 'en_US', expect.any(Array), undefined, undefined
        );
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE messages SET status='sent'"),
            expect.arrayContaining(['wamid.123', 1]),
            expect.any(Function)
        );
    });

    it('should skip message if race condition detected (lock failed)', async () => {
        // 1. Mock Rate Limit
        db.get.mockImplementationOnce((query, cb) => cb(null, { value: '10' }));

        // 2. Mock Fetch Message
        const mockMsg = { id: 2, status: 'queued' };
        db.get.mockImplementationOnce((query, params, cb) => cb(null, mockMsg));

        // 3. Mock Lock Failure (changes = 0)
        db.run.mockImplementationOnce((query, params, cb) => {
            cb.call({ changes: 0 }, null); // Lock failed!
        });

        worker.startWorker(mockIo);
        await new Promise(resolve => process.nextTick(resolve));

        expect(whatsappService.sendMessage).not.toHaveBeenCalled();
        // Should verify it logged warning "Race condition detected"
        // But we didn't inspect logs. Assert on behavior: no send.
    });
});
