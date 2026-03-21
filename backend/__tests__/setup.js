// Test setup - runs before all tests
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_SECRET = 'test-secret-key-for-testing-only';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
};
