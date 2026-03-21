const request = require('supertest');
const express = require('express');
const mediaRouter = require('../routes/media');

// Mocks
jest.mock('fs', () => ({
    unlinkSync: jest.fn(),
    existsSync: jest.fn(() => true),
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

const whatsappService = require('../services/whatsappService');
const fs = require('fs');

describe('Media Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/media', mediaRouter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/media/upload', () => {
        it('should upload image successfully', async () => {
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
            whatsappService.uploadMedia.mockRejectedValue(new Error('Upload failed'));

            const response = await request(app)
                .post('/api/media/upload')
                .expect(500);

            expect(response.body.error).toBe('Upload failed');
            expect(fs.unlinkSync).toHaveBeenCalled(); // Ensure cleanup called even on error
        });
    });
});
