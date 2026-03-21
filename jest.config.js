module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'backend/**/*.js',
        '!backend/node_modules/**',
        '!backend/database.js', // Skip database setup file
    ],
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],
    verbose: true,
    testTimeout: 10000,
    testPathIgnorePatterns: ['/node_modules/', '/tests/'],
    setupFilesAfterEnv: ['<rootDir>/backend/__tests__/setup.js'],
};
