module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // Only run setup for integration tests
  setupFilesAfterEnv: process.env.TEST_TYPE === 'integration' ? ['<rootDir>/tests/setup/jest-setup.ts'] : [],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!tests/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: process.env.TEST_TYPE === 'integration' ? 60000 : 5000, // 60s for integration, 5s for unit
  ...(process.env.TEST_TYPE === 'integration' && { maxWorkers: 1 }), // Sequential for integration tests
};
