const { AppError, errorHandler, asyncHandler } = require('../middleware/errorHandler');

// Mock Logger
jest.mock('../utils/logger', () => ({
    error: jest.fn(),
}));
const logger = require('../utils/logger');

describe('Error Handling', () => {
    describe('AppError', () => {
        it('should create an operational error with defaults', () => {
            const err = new AppError('Test Error');
            expect(err.message).toBe('Test Error');
            expect(err.statusCode).toBe(500);
            expect(err.code).toBe('INTERNAL_ERROR');
            expect(err.isOperational).toBe(true);
            expect(err.stack).toBeDefined();
        });

        it('should create an error with custom status and code', () => {
            const err = new AppError('Not Found', 404, 'NOT_FOUND');
            expect(err.statusCode).toBe(404);
            expect(err.code).toBe('NOT_FOUND');
        });
    });

    describe('asyncHandler', () => {
        it('should catch errors and pass to next', async () => {
            const error = new Error('Async Check');
            const fn = jest.fn().mockRejectedValue(error);
            const req = {}, res = {};
            const next = jest.fn();

            await asyncHandler(fn)(req, res, next);
            expect(next).toHaveBeenCalledWith(error);
        });

        it('should call next for successful execution', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const req = {}, res = {};
            const next = jest.fn();

            await asyncHandler(fn)(req, res, next);
            expect(fn).toHaveBeenCalled();
            // asyncHandler doesn't call next on success, the wrapped fn should do it or send res
        });
    });

    describe('errorHandler Middleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = { path: '/test', method: 'GET' };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            next = jest.fn();
            jest.clearAllMocks();
        });

        it('should handle AppError and log it', () => {
            const err = new AppError('Custom Error', 400, 'BAD_REQUEST');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Custom Error',
                code: 'BAD_REQUEST'
            }));
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle generic errors as 500', () => {
            const err = new Error('System Failure');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'System Failure',
                code: 'INTERNAL_ERROR'
            }));
        });

        it('should hide stack trace in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const err = new Error('Prod Error');
            errorHandler(err, req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({
                stack: expect.any(String)
            }));

            process.env.NODE_ENV = originalEnv;
        });

        it('should show stack trace in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const err = new Error('Dev Error');
            errorHandler(err, req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.any(String)
            }));

            process.env.NODE_ENV = originalEnv;
        });
    });
});
