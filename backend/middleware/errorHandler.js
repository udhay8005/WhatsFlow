/**
 * @file errorHandler.js
 * @description Centralized Express error handling middleware.
 *              Provides the AppError class for operational errors,
 *              a global handler that masks internals in production,
 *              and an asyncHandler wrapper for async route functions.
 * @module backend/middleware/errorHandler
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

// Standardized error response middleware

/**
 * @class AppError
 * @extends Error
 * @description Operational error with an HTTP status code and machine-readable code.
 *              Use this for expected errors (invalid input, not found, etc.).
 *              Unexpected errors (bugs) should propagate as native Errors.
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * @function errorHandler
 * @description Express 4-argument error middleware. Must be registered last.
 *              Logs the full error, then sends a sanitized JSON response.
 *              Stack traces and raw messages are hidden in production.
 * @param {Error} err - The caught error.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
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

    // Send standardized error response (mask internals in production)
    const isProduction = process.env.NODE_ENV === 'production';
    const safeMessage = err.isOperational ? err.message : (isProduction ? 'An unexpected error occurred' : err.message);

    res.status(statusCode).json({
        error: safeMessage,
        code: code,
        ...(!isProduction && { stack: err.stack }),
    });
};

/**
 * @function asyncHandler
 * @description Wraps an async Express route handler and forwards any rejected
 *              promise to the next() error pipeline automatically.
 * @param {Function} fn - Async route handler (req, res, next) => Promise.
 * @returns {Function} Wrapped route handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    errorHandler,
    asyncHandler,
};
