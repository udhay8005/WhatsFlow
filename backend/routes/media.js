/**
 * @file media.js
 * @description Media upload REST API route.
 *              Accepts JPG, PNG, and MP4 files via multipart upload, validates
 *              file content using magic-byte detection (prevents MIME spoofing),
 *              then proxies the file to the WhatsApp media endpoint and returns
 *              the resulting media ID. Temp files are always cleaned up.
 * @module backend/routes/media
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

// Magic byte signatures for allowed file types
const MAGIC_BYTES = {
    'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
    'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
    'video/mp4': [
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp at offset 0
        Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]), // ftyp variant
        Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // ftyp variant
    ]
};

/**
 * @function detectMimeType
 * @description Reads the first 12 bytes of a file and identifies its type by
 *              matching known magic-byte signatures. Supports JPEG, PNG, and MP4.
 * @param {string} filePath - Absolute path to the file to inspect.
 * @returns {'image/jpeg'|'image/png'|'video/mp4'|null} Detected MIME type, or null if unknown.
 */
function detectMimeType(filePath) {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);

    // Check JPEG (FFD8FF)
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return 'image/jpeg';
    // Check PNG (89504E47)
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return 'image/png';
    // Check MP4 (ftyp at bytes 4-7)
    if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) return 'video/mp4';

    return null;
}

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

    try {
        // Validate actual file content via magic bytes (prevents MIME spoofing)
        const detectedMime = detectMimeType(tempPath);
        const allowedMimes = ['image/jpeg', 'image/png', 'video/mp4'];

        if (!detectedMime || !allowedMimes.includes(detectedMime)) {
            fs.unlinkSync(tempPath);
            return res.status(400).json({ error: 'File content does not match an allowed type (JPG, PNG, MP4)' });
        }

        // Use the detected MIME type (not the client-supplied one)
        const mimeType = detectedMime;

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
        res.status(500).json({ error: 'Media upload failed' });
    }
});

module.exports = router;
