/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/__tests__/**/*.test.mjs'
  ],
  roots: ['<rootDir>'],
  verbose: true,
};


