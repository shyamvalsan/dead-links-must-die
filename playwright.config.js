const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000, // 30 seconds default
  retries: 0, // No retries for now
  workers: 4, // Run tests in parallel

  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'unit',
      testMatch: /.*\/unit\/.*\.spec\.js/,
      timeout: 10000, // Unit tests should be fast
    },
    {
      name: 'integration',
      testMatch: /.*\/integration\/.*\.spec\.js/,
      timeout: 30000,
    },
    {
      name: 'e2e',
      testMatch: /.*\/e2e\/.*\.spec\.js/,
      timeout: 180000, // E2E tests can be slow (3 minutes)
      retries: 1, // Retry once for flaky network issues
    },
  ],

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
});
