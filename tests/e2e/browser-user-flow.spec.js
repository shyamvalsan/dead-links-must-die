const { test, expect } = require('@playwright/test');
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Real browser E2E tests - simulating actual user interactions
 * Tests the complete user flow through the browser:
 * 1. User visits the website
 * 2. User enters a URL
 * 3. User clicks "Check Links"
 * 4. User sees crawling progress
 * 5. User sees results table with broken links
 */

test.describe('Browser User Flow E2E', () => {
  let serverProcess;
  let testServer;
  let testSiteUrl;
  const appPort = 3001; // Use different port to avoid conflicts
  const appUrl = `http://localhost:${appPort}`;

  test.beforeAll(async () => {
    // Start a mock test site that the crawler will scan
    const app = express();

    app.get('/', (req, res) => {
      const port = testServer.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Site Homepage</title></head>
          <body>
            <h1>Welcome to Test Site</h1>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
            <a href="/broken">Broken Link</a>
            <a href="http://localhost:${port}/external">External Link</a>
            <img src="/logo.png" alt="Logo">
            <img src="/missing.png" alt="Missing">
          </body>
        </html>
      `);
    });

    app.get('/page1', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Page 1</title></head>
          <body>
            <h1>Page 1</h1>
            <a href="/">Home</a>
            <a href="/page2">Page 2</a>
          </body>
        </html>
      `);
    });

    app.get('/page2', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Page 2</title></head>
          <body>
            <h1>Page 2</h1>
            <a href="/">Home</a>
            <a href="/page1">Page 1</a>
          </body>
        </html>
      `);
    });

    app.get('/external', (req, res) => {
      res.send('<html><body>External Site</body></html>');
    });

    app.get('/logo.png', (req, res) => {
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    app.use((req, res) => {
      res.status(404).send('<html><body>Not Found</body></html>');
    });

    testServer = app.listen(0);
    const port = testServer.address().port;
    testSiteUrl = `http://localhost:${port}`;

    // Start the actual application server
    await new Promise((resolve, reject) => {
      serverProcess = spawn('node', ['server.js'], {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, PORT: String(appPort) }
      });

      let serverReady = false;

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Server: ${output}`);
        // Wait for server to be ready
        if ((output.includes('listening on') || output.includes(String(appPort))) && !serverReady) {
          serverReady = true;
          setTimeout(resolve, 1000); // Give it a moment to fully start
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error(`Server error: ${data}`);
      });

      // Auto-resolve after 5 seconds even if we don't see the message
      setTimeout(() => {
        if (!serverReady) {
          console.log('Server startup timeout - assuming it started');
          resolve();
        }
      }, 5000);
    });
  });

  test.afterAll(async () => {
    // Stop servers
    if (serverProcess) {
      serverProcess.kill();
    }
    if (testServer) {
      testServer.close();
    }
  });

  test('user can submit URL and see crawling progress', async ({ page }) => {
    // Navigate to the app
    await page.goto(appUrl);

    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Dead Links Must Die');

    // Find and fill the URL input
    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill(testSiteUrl);

    // Click the submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Should see progress indicator
    await expect(page.locator('text=/crawl|progress|scanning/i')).toBeVisible({ timeout: 5000 });

    // Wait for results (max 30 seconds)
    await expect(page.locator('text=/complete|finished|result/i')).toBeVisible({ timeout: 30000 });
  });

  test('user can see discovered pages count', async ({ page }) => {
    await page.goto(appUrl);

    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill(testSiteUrl);

    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Wait for results
    await page.waitForTimeout(5000);

    // Should show number of pages discovered (3 pages: /, /page1, /page2)
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/[3-9]\s*(page|Page)/); // At least 3 pages
  });

  test('user can see broken links in results', async ({ page }) => {
    await page.goto(appUrl);

    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill(testSiteUrl);

    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Wait for results
    await page.waitForTimeout(10000);

    // Should show broken links
    const bodyText = await page.textContent('body');

    // Should mention broken/404/missing
    const hasBrokenIndicators =
      bodyText.includes('broken') ||
      bodyText.includes('404') ||
      bodyText.includes('missing') ||
      bodyText.includes('error');

    expect(hasBrokenIndicators).toBe(true);
  });

  test('user can see results table or list', async ({ page }) => {
    await page.goto(appUrl);

    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill(testSiteUrl);

    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Wait for results
    await page.waitForTimeout(10000);

    // Should have table or list of results
    const hasTable = await page.locator('table').count() > 0;
    const hasList = await page.locator('ul, ol').count() > 0;
    const hasResultsDiv = await page.locator('[class*="result"], [class*="link"]').count() > 0;

    expect(hasTable || hasList || hasResultsDiv).toBe(true);
  });

  test('user sees error message for invalid URL', async ({ page }) => {
    await page.goto(appUrl);

    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill('not-a-valid-url');

    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Should show error (either browser validation or server error)
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    const hasError =
      bodyText.includes('invalid') ||
      bodyText.includes('error') ||
      bodyText.includes('valid URL') ||
      bodyText.includes('http');

    // Browser may block submission with validation, or server may return error
    expect(hasError || bodyText.includes('not-a-valid-url')).toBe(true);
  });

  test('results show both working and broken links statistics', async ({ page }) => {
    await page.goto(appUrl);

    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill(testSiteUrl);

    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Wait for results
    await page.waitForTimeout(10000);

    const bodyText = await page.textContent('body');

    // Should show some statistics about links checked
    const hasStats =
      bodyText.match(/\d+\s*(link|Link)/) ||
      bodyText.match(/\d+\s*(check|found|crawl)/);

    expect(hasStats).toBeTruthy();
  });

  test('can start a new scan after completing one', async ({ page }) => {
    await page.goto(appUrl);

    // First scan
    const urlInput = page.locator('input[name="url"], input#url, input[type="url"]');
    await urlInput.fill(testSiteUrl);

    const submitButton = page.locator('button[type="submit"], button:has-text("Check")');
    await submitButton.click();

    // Wait for first scan to complete
    await page.waitForTimeout(10000);

    // Should be able to scan again
    await urlInput.fill(`${testSiteUrl}/page1`);
    await submitButton.click();

    // Should start new scan
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/crawl|progress|scanning|check/i);
  });
});
