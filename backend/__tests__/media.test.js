const request = require('supertest');
const express = require('express');
const mediaRouter = require('../routes/media');

// Track which MIME type the current test wants so readSync can write matching magic bytes
let mockTestMime = 'image/jpeg';

// Mocks — include all fs methods used by detectMimeType + cleanup
jest.mock('fs', () => ({
    unlinkSync: jest.fn(),
    existsSync: jest.fn(() => true),
    openSync: jest.fn(() => 99),     // fake file descriptor
    readSync: jest.fn((fd, buf) => {
        // Write magic bytes based on the requested test MIME type
        if (mockTestMime === 'video/mp4') {
            // MP4: "ftyp" at bytes 4-7
            buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70;
        } else if (mockTestMime === 'image/png') {
            // PNG: 89 50 4E 47
            buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47;
        } else {
            // JPEG: FF D8 FF
            buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF;
        }
        return 12;
    }),
    closeSync: jest.fn(),
}));

jest.mock('../services/whatsappService', () => ({
    uploadMedia: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
}));

// Mock Multer to bypass actual file parsing but simulate req.file
jest.mock('multer', () => {
    const multer = () => ({
        single: () => (req, res, next) => {
            // Simulate missing file case
            if (req.headers['x-test-no-file']) {
                return next();
            }
            // Simulate file present
            req.file = {
                path: 'temp/uploads/test-image.jpg',
                mimetype: req.headers['x-test-mimetype'] || 'image/jpeg',
                size: 1024
            };
            next();
        }
    });
    return multer;
});

const { errorHandler } = require('../middleware/errorHandler');
const whatsappService = require('../services/whatsappService');
const fs = require('fs');

describe('Media Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/media', mediaRouter);
        app.use(errorHandler); // Catch asyncHandler forwarded errors
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockTestMime = 'image/jpeg'; // Reset default
    });

    describe('POST /api/media/upload', () => {
        it('should upload image successfully', async () => {
            mockTestMime = 'image/jpeg';
            whatsappService.uploadMedia.mockResolvedValue('media_id_123');

            const response = await request(app)
                .post('/api/media/upload')
                .set('x-test-mimetype', 'image/jpeg')
                .expect(200);

            expect(response.body).toEqual({
                mediaId: 'media_id_123',
                mediaType: 'image',
                uploadedAt: expect.any(String)
            });

            expect(whatsappService.uploadMedia).toHaveBeenCalledWith(
                'temp/uploads/test-image.jpg',
                'image/jpeg'
            );
            expect(fs.unlinkSync).toHaveBeenCalled(); // cleanup
        });

        it('should upload video successfully', async () => {
            mockTestMime = 'video/mp4';
            whatsappService.uploadMedia.mockResolvedValue('media_id_video');

            const response = await request(app)
                .post('/api/media/upload')
                .set('x-test-mimetype', 'video/mp4')
                .expect(200);

            expect(response.body).toEqual({
                mediaId: 'media_id_video',
                mediaType: 'video',
                uploadedAt: expect.any(String)
            });
        });

        it('should return 400 if no file uploaded', async () => {
            await request(app)
                .post('/api/media/upload')
                .set('x-test-no-file', 'true')
                .expect(400);
        });

        it('should handle service errors', async () => {
            mockTestMime = 'image/jpeg';
            whatsappService.uploadMedia.mockRejectedValue(new Error('Upload failed'));

            const response = await request(app)
                .post('/api/media/upload')
                .expect(500);

            // The route returns a generic error message to avoid leaking internals
            expect(response.body.error).toBe('Media upload failed');
            expect(fs.unlinkSync).toHaveBeenCalled(); // Ensure cleanup called even on error
        });
    });
});
