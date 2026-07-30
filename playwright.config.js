const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e/tests',
  testMatch: '**/*.spec.js',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  outputDir: 'test-results/playwright',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
