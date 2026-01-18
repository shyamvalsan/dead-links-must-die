const { test, expect } = require('@playwright/test');
const { smartCrawl } = require('../../smart-crawler');
const { checkLinks } = require('../../checker');
const express = require('express');

/**
 * Integration tests for full crawl + link checking flow
 * Tests the complete pipeline: discover pages → extract links → check links
 */

test.describe('Full Crawl and Link Check Integration', () => {
  let server;
  let baseUrl;

  test.beforeAll(async () => {
    const app = express();

    // Homepage with mix of working and broken links
    app.get('/', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Homepage</title></head>
          <body>
            <h1>Test Site</h1>
            <a href="/about">About (internal, working)</a>
            <a href="/contact">Contact (internal, working)</a>
            <a href="/broken-internal">Broken Internal Link</a>
            <a href="http://localhost:${port}/api/working">API Working</a>
            <a href="https://this-is-definitely-broken-404.com">External Broken Link</a>
            <img src="/logo.png" alt="Logo">
            <img src="/missing-image.png" alt="Missing Image">
          </body>
        </html>
      `);
    });

    // About page with some broken links
    app.get('/about', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>About Us</title></head>
          <body>
            <h1>About</h1>
            <a href="/">Home</a>
            <a href="/broken-page">Broken Page</a>
            <a href="http://localhost:${port}/error-500">Internal 500</a>
            <a href="http://localhost:${port}/forbidden-403">Internal 403</a>
          </body>
        </html>
      `);
    });

    // Contact page
    app.get('/contact', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Contact</title></head>
          <body>
            <h1>Contact Us</h1>
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="http://localhost:${port}/redirect-me">Redirect Link</a>
          </body>
        </html>
      `);
    });

    // Working logo endpoint
    app.get('/logo.png', (req, res) => {
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header
    });

    // Working API endpoint
    app.get('/api/working', (req, res) => {
      res.json({ status: 'ok' });
    });

    // 500 error endpoint
    app.get('/error-500', (req, res) => {
      res.status(500).send('<html><body>Internal Server Error</body></html>');
    });

    // 403 forbidden endpoint
    app.get('/forbidden-403', (req, res) => {
      res.status(403).send('<html><body>Forbidden</body></html>');
    });

    // Redirect endpoint
    app.get('/redirect-me', (req, res) => {
      const port = server.address().port;
      res.redirect(302, `http://localhost:${port}/api/working`);
    });

    // 404 for anything else
    app.use((req, res) => {
      res.status(404).send('<html><body>Not Found</body></html>');
    });

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    server.close();
  });

  test('crawls site and identifies all broken links', async () => {
    // Step 1: Crawl the site
    const crawlResult = await smartCrawl(baseUrl);

    // Should discover main pages
    expect(crawlResult.pages.length).toBeGreaterThanOrEqual(3);

    // Should use traditional method
    expect(crawlResult.method).toBe('traditional');

    // Step 2: Check all links
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should have checked links
    expect(checkResult.summary.linksChecked).toBeGreaterThan(0);

    // Should find broken links (dead domain + missing image)
    expect(checkResult.brokenLinks.length).toBeGreaterThan(0);

    // Should identify the missing image as broken
    const missingImage = checkResult.brokenLinks.find(bl =>
      bl.url.includes('missing-image.png')
    );
    expect(missingImage).toBeDefined();
  });

  test('correctly categorizes broken links vs warnings', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should have some results
    const totalIssues = checkResult.brokenLinks.length + checkResult.warnings.length;
    expect(totalIssues).toBeGreaterThan(0);

    // Verify structure: each broken link should have status and message
    for (const bl of checkResult.brokenLinks) {
      expect(bl.status).toBeDefined();
      expect(bl.message).toBeDefined();
    }

    // Verify structure: each warning should have status and message
    for (const w of checkResult.warnings) {
      expect(w.status).toBeDefined();
      expect(w.message).toBeDefined();
    }
  });

  test('skips internal links that were already crawled', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should skip internal pages (/, /about, /contact) from link checking
    expect(checkResult.summary.linksSkipped).toBeGreaterThanOrEqual(3);

    // Skipped links should be the internal pages
    const homepageUrl = `${baseUrl}/`;
    const aboutUrl = `${baseUrl}/about`;
    const contactUrl = `${baseUrl}/contact`;

    // These should NOT be in brokenLinks since they were crawled
    expect(checkResult.brokenLinks.some(bl => bl.url === homepageUrl)).toBe(false);
    expect(checkResult.brokenLinks.some(bl => bl.url === aboutUrl)).toBe(false);
    expect(checkResult.brokenLinks.some(bl => bl.url === contactUrl)).toBe(false);
  });

  test('handles redirects correctly', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should detect redirects
    expect(checkResult.redirects.length).toBeGreaterThan(0);

    // Redirect should have finalUrl
    const redirect = checkResult.redirects.find(r => r.url.includes('redirect'));
    if (redirect) {
      expect(redirect.redirectTo).toBeDefined();
    }
  });

  test('provides per-page breakdown of broken links', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should have per-page results
    expect(checkResult.pages.length).toBeGreaterThan(0);

    // Each page should have totalLinks and brokenLinks count
    for (const page of checkResult.pages) {
      expect(page.url).toBeDefined();
      expect(page.title).toBeDefined();
      expect(page.totalLinks).toBeGreaterThanOrEqual(0);
      expect(page.brokenLinks).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(page.brokenLinksList)).toBe(true);
    }

    // Homepage should have broken links
    const homepage = checkResult.pages.find(p => p.url === `${baseUrl}/`);
    expect(homepage).toBeDefined();
    expect(homepage.brokenLinks).toBeGreaterThan(0);
  });

  test('tracks where each broken link appears', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Each broken link should have occurrences
    for (const brokenLink of checkResult.brokenLinks) {
      expect(brokenLink.url).toBeDefined();
      expect(brokenLink.status).toBeDefined();
      expect(brokenLink.message).toBeDefined();
      expect(Array.isArray(brokenLink.occurrences)).toBe(true);
      expect(brokenLink.occurrences.length).toBeGreaterThan(0);

      // Each occurrence should have page, text, type
      for (const occurrence of brokenLink.occurrences) {
        expect(occurrence.page).toBeDefined();
        expect(occurrence.text).toBeDefined();
        expect(occurrence.type).toBeDefined();
      }
    }
  });

  test('handles images correctly', async () => {
    const crawlResult = await smartCrawl(baseUrl);

    // Pages should have images in their links
    const homepage = crawlResult.pages.find(p => p.url === `${baseUrl}/`);
    expect(homepage).toBeDefined();
    expect(homepage.imagesCount).toBeGreaterThan(0);

    // Check if images are validated
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Missing image should be in broken links
    const missingImage = checkResult.brokenLinks.find(bl =>
      bl.url.includes('missing-image.png')
    );
    expect(missingImage).toBeDefined();
    expect(missingImage.occurrences[0].type).toBe('image');
  });

  test('provides accurate summary statistics', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    const summary = checkResult.summary;

    // Summary should have all required fields
    expect(summary.totalPages).toBeGreaterThan(0);
    expect(summary.totalLinks).toBeGreaterThan(0);
    expect(summary.linksChecked).toBeGreaterThan(0);
    expect(summary.linksSkipped).toBeGreaterThan(0);
    expect(summary.brokenLinks).toBeGreaterThan(0);
    expect(summary.workingLinks).toBeGreaterThanOrEqual(0);
    expect(summary.redirects).toBeGreaterThanOrEqual(0);
    expect(summary.warnings).toBeGreaterThanOrEqual(0);

    // Verify all numbers are non-negative
    expect(summary.totalPages).toBeGreaterThanOrEqual(0);
    expect(summary.totalLinks).toBeGreaterThanOrEqual(0);
    expect(summary.linksChecked).toBeGreaterThanOrEqual(0);
  });
});
