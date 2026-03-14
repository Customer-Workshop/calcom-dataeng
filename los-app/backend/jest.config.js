module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/migrations/**', '!src/seeds/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
};
