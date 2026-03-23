/**
 * @file server.js
 * @description Express HTTP server entry point for WhatsFlow backend.
 *              Initialises middleware (Helmet CSP, CORS, compression, rate limiting),
 *              mounts all API routes with API-key authentication, starts the
 *              message-queue worker, cron jobs, optional LocalTunnel, and handles
 *              graceful shutdown on SIGTERM / SIGINT.
 * @module backend/server
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { apiAuth, issueToken } = require('./middleware/auth');

const app = express();
// Ensure uploads directory exists.
// WHATSFLOW_USER_DATA is set by Electron main before requiring this module; it
// points to the writable AppData folder.  The resolved path is written back into
// process.env.WHATSFLOW_UPLOADS_DIR so every route module (media.js, settings.js)
// resolves the exact same physical directory — eliminating the previous mismatch
// where server.js created root/uploads but media.js wrote into backend/uploads.
const fs = require('fs');
const path = require('path');
const uploadsDir = process.env.WHATSFLOW_USER_DATA
    ? path.join(process.env.WHATSFLOW_USER_DATA, 'uploads')
    : path.join(__dirname, '../uploads');
process.env.WHATSFLOW_UPLOADS_DIR = uploadsDir; // shared canonical path for route modules
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info('Created uploads directory: ' + uploadsDir);
}

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6  // 1 MB — mitigates memory-DoS from oversized binary payloads (CVE GHSA-677m-j7p3-52f9)
});

const helmet = require('helmet');
const compression = require('compression');

// Middleware
// Security headers with Content Security Policy
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws://localhost:3000", "http://localhost:3000", "ws://localhost:5173", "http://localhost:5173"],
            fontSrc: ["'self'"],
        }
    }
}));
// Gzip compression
app.use(compression());

// Production: Electron serves from file://, no CORS needed
if (process.env.NODE_ENV !== 'production') {
    app.use(cors({
        origin: 'http://localhost:5173',
        credentials: true
    }));
}
// JSON parsing for all routes EXCEPT /webhook (which needs raw body for HMAC)
app.use((req, res, next) => {
    if (req.path.startsWith('/webhook')) return next(); // Skip — webhook handles its own parsing
    express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
    if (req.path.startsWith('/webhook')) return next();
    express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// Serve static frontend assets in production.
// The SPA catch-all wildcard is intentionally registered AFTER all API routes
// below so Express matches specific routes first — no fragile path-prefix
// whitelist needed. frontendPath is kept module-scoped for the deferred wildcard.
let frontendPath = null;
if (process.env.NODE_ENV === 'production') {
    frontendPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(frontendPath));
    logger.info('Serving frontend from: ' + frontendPath);
}

// Make io accessible in routes
app.set('io', io);

// Health check with DB validation
app.get('/health', (req, res) => {
    db.get("SELECT 1 as alive", [], (err, row) => {
        if (err || !row) {
            return res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err?.message });
        }
        res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    });
});

// Rate limiter for API routes (prevent abuse)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth token endpoint (localhost only, no API key needed)
app.get('/auth/token', issueToken);

// API Routes
app.use('/api/', apiLimiter); // Apply rate limiting to all /api/* routes
app.use('/api/', apiAuth); // Require API key for all /api/* routes
app.use('/webhook', require('./routes/webhook')); // Webhook has its own HMAC auth
app.use('/api/settings', require('./routes/settings'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/media', require('./routes/media'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/contacts', require('./routes/contacts'));

// SPA fallback — registered here, AFTER every API/auth/webhook/health route, so
// Express only reaches this handler when no specific route matched the request.
// This removes the need for the fragile path-prefix whitelist that was previously
// required when the wildcard was placed before the API routes.
if (frontendPath) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

const { startWorker, stopWorker } = require('./worker');
const { startCronJobs } = require('./cron');
const { startTunnel, stopTunnel } = require('./tunnelManager');

// Start Server
const PORT = process.env.PORT || 3000;
if (require.main === module || process.env.NODE_ENV === 'production') {
    server.listen(PORT, async () => {
        logger.info(`Server running on http://localhost:${PORT}`);
        startWorker(io); // Start the Queue Processor
        startCronJobs(); // Start Scheduled Tasks

        // Auto-start LocalTunnel if enabled
        if (process.env.ENABLE_TUNNEL === 'true') {
            try {
                // Use default subdomain from tunnelManager.js, or override with env var if set
                if (process.env.TUNNEL_SUBDOMAIN) {
                    await startTunnel(PORT, process.env.TUNNEL_SUBDOMAIN);
                } else {
                    await startTunnel(PORT); // Uses default from tunnelManager.js
                }
            } catch (error) {
                logger.warn('Failed to start tunnel - webhooks will only work on local network');
            }
        }
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is already in use. Close other instances and restart.`);
            process.exit(1);
        } else {
            logger.error('Server error: ' + err.message);
            throw err;
        }
    });
}

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    logger.info('Socket.IO client connected: ' + socket.id);

    socket.on('disconnect', (reason) => {
        logger.info('Socket.IO client disconnected: ' + socket.id + ', reason: ' + reason);
    });

    socket.on('error', (error) => {
        logger.error('Socket.IO error:', error);
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

/**
 * @function gracefulShutdown
 * @description Stops all running services (tunnel, worker, database, HTTP server)
 *              in order before exiting the process. Invoked on SIGTERM and SIGINT.
 * @param {string} signal - The OS signal that triggered shutdown (e.g. 'SIGTERM').
 * @returns {Promise<void>}
 */
async function gracefulShutdown(signal) {
    logger.info(`${signal} received, closing server gracefully`);
    await stopTunnel();
    stopWorker();
    // Close both the reader and writer database connections
    if (db.dbWriter) {
        db.dbWriter.close((err) => {
            if (err) logger.error('Error closing writer connection:', err);
        });
    }
    db.close((err) => {
        if (err) logger.error('Error closing database:', err);
        else logger.info('Database connections closed');
    });
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };
