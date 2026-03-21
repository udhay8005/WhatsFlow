const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
// Ensure uploads directory exists
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    logger.info('Created missing uploads directory');
}

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

const helmet = require('helmet');
const compression = require('compression');

// Middleware
// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for local dev flexibility
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    const frontendPath = path.join(__dirname, '../frontend/dist');
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

// API Routes
app.use('/api/', apiLimiter); // Apply rate limiting to all /api/* routes
app.use('/webhook', require('./routes/webhook'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/media', require('./routes/media'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/contacts', require('./routes/contacts'));

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

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing server gracefully');
    await stopTunnel(); // Close tunnel first
    stopWorker();
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing server gracefully');
    await stopTunnel(); // Close tunnel first
    stopWorker();
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
