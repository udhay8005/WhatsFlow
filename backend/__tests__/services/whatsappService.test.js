const whatsappService = require('../../services/whatsappService');
const axios = require('axios');
const db = require('../../database');
const cryptoService = require('../../services/cryptoService');
const fs = require('fs');

// Mock Dependencies
jest.mock('axios');
jest.mock('../../database', () => ({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    serialize: jest.fn()
}));
jest.mock('../../services/cryptoService');
jest.mock('fs');
jest.mock('form-data', () => {
    return jest.fn().mockImplementation(() => ({
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data bounds=xxx' })
    }));
});
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

describe('WhatsApp Service', () => {
    const mockCreds = [
        { key: 'wa_access_token', value: 'encrypted_token' },
        { key: 'wa_phone_id', value: 'encrypted_phone_id' },
        { key: 'wa_waba_id', value: 'encrypted_waba_id' }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // 1. Mock Database to return config
        db.all.mockImplementation((query, params, callback) => {
            callback(null, mockCreds);
        });

        // 2. Mock Crypto to "decrypt"
        cryptoService.decrypt.mockImplementation((val) => {
            return val.replace('encrypted_', 'test_'); // e.g., test_token
        });
    });

    describe('getTemplates', () => {
        it('should fetch templates successfully', async () => {
            // Mock Axios Response
            const mockResponse = { data: { data: [{ name: 'template_1', status: 'APPROVED' }] } };
            axios.get.mockResolvedValue(mockResponse);

            const templates = await whatsappService.getTemplates();

            expect(templates).toHaveLength(1);
            expect(templates[0].name).toBe('template_1');

            // Verify Axios Call
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining('/test_waba_id/message_templates'),
                expect.objectContaining({
                    headers: { 'Authorization': 'Bearer test_token' }
                })
            );
        });

        it('should handle API errors', async () => {
            axios.get.mockRejectedValue(new Error('API Error'));
            await expect(whatsappService.getTemplates()).rejects.toThrow('API Error');
        });
    });

    describe('sendMessage', () => {
        it('should send a text message successfully', async () => {
            const mockResponse = { data: { messages: [{ id: 'wamid.123' }] } };
            axios.post.mockResolvedValue(mockResponse);

            const result = await whatsappService.sendMessage('+1234567890', 'hello_world', 'en_US');

            expect(result.messages[0].id).toBe('wamid.123');
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/test_phone_id/messages'),
                expect.objectContaining({
                    to: '+1234567890',
                    template: expect.objectContaining({ name: 'hello_world' })
                }),
                expect.any(Object)
            );
        });

        it('should include header component if mediaId is provided', async () => {
            const mockResponse = { data: { messages: [{ id: 'wamid.123' }] } };
            axios.post.mockResolvedValue(mockResponse);

            await whatsappService.sendMessage('+1234567890', 'media_template', 'en_US', [], 'media_id_123', 'image');

            // Verify payload structure includes header
            const payload = axios.post.mock.calls[0][1];
            const headerComponent = payload.template.components.find(c => c.type === 'header');

            expect(headerComponent).toBeDefined();
            expect(headerComponent.parameters[0].type).toBe('image');
            expect(headerComponent.parameters[0].image.id).toBe('media_id_123');
        });
    });

    describe('uploadMedia', () => {
        it('should upload media successfully', async () => {
            const mockResponse = { data: { id: 'media_id_999' } };
            axios.post.mockResolvedValue(mockResponse);
            fs.createReadStream.mockReturnValue('mock_stream');

            const mediaId = await whatsappService.uploadMedia('/path/to/image.jpg', 'image/jpeg');

            expect(mediaId).toBe('media_id_999');
            expect(fs.createReadStream).toHaveBeenCalledWith('/path/to/image.jpg');
            // Check if Axios was called with the correct URL
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/test_phone_id/media'),
                expect.any(Object), // FormData mock makes deep inspection hard, verify URL mainly
                expect.any(Object)
            );
        });
    });
});
