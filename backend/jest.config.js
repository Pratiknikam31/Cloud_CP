/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Integration tests share one DynamoDB Local table per test file.
  testTimeout: 30000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
};
