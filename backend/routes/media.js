const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

// Configure multer for file uploads
const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and MP4 are allowed.'));
        }
    }
});

// POST /api/media/upload
router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const tempPath = req.file.path;
    const mimeType = req.file.mimetype;

    try {
        // Upload to WhatsApp
        const mediaId = await whatsappService.uploadMedia(tempPath, mimeType);

        // Cleanup temp file
        fs.unlinkSync(tempPath);

        const mediaType = mimeType.startsWith('image/') ? 'image' : 'video';

        res.json({
            mediaId,
            mediaType,
            uploadedAt: new Date().toISOString()
        });
    } catch (error) {
        // Cleanup temp file on error
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        logger.error('[Media Upload] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
