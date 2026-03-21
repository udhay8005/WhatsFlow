// Standardized error response middleware

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    const logger = require('../utils/logger');

    // Log error
    logger.error('API Error:', {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack,
    });

    // Determine status code
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';

    // Send standardized error response
    res.status(statusCode).json({
        error: err.message || 'An unexpected error occurred',
        code: code,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

// Async handler wrapper (catches async errors)
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    errorHandler,
    asyncHandler,
};
