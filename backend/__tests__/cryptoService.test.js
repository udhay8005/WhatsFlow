const cryptoService = require('../services/cryptoService');

describe('Crypto Service', () => {
    describe('encrypt', () => {
        it('should encrypt plain text', () => {
            const plainText = 'test-password-123';
            const encrypted = cryptoService.encrypt(plainText);

            expect(encrypted).toBeTruthy();
            expect(encrypted).not.toBe(plainText);
            expect(encrypted).toContain('DEV_ENC:'); // Development mode encryption
        });

        it('should return empty string for empty input', () => {
            const encrypted = cryptoService.encrypt('');
            expect(encrypted).toBe('');
        });

        it('should return empty string for null input', () => {
            const encrypted = cryptoService.encrypt(null);
            expect(encrypted).toBe('');
        });
    });

    describe('decrypt', () => {
        it('should decrypt encrypted text', () => {
            const plainText = 'test-password-123';
            const encrypted = cryptoService.encrypt(plainText);
            const decrypted = cryptoService.decrypt(encrypted);

            expect(decrypted).toBe(plainText);
        });

        it('should return empty string for empty input', () => {
            const decrypted = cryptoService.decrypt('');
            expect(decrypted).toBe('');
        });

        it('should return empty string for invalid cipher text', () => {
            const decrypted = cryptoService.decrypt('invalid-cipher');
            expect(decrypted).toBe('');
        });
    });

    describe('round-trip encryption', () => {
        it('should maintain data integrity', () => {
            const testData = [
                'simple-password',
                'complex-P@ssw0rd!',
                'unicode-密码-пароль',
                '123456789',
            ];

            testData.forEach(data => {
                const encrypted = cryptoService.encrypt(data);
                const decrypted = cryptoService.decrypt(encrypted);
                expect(decrypted).toBe(data);
            });
        });
    });
});
