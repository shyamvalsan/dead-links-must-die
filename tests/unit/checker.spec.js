const { test, expect } = require('@playwright/test');
const { checkLinks } = require('../../checker');
const express = require('express');

test.describe('Link Checker - Unit Tests', () => {
  let server;
  let baseUrl;

  test.beforeAll(async () => {
    const app = express();

    // Working endpoint
    app.get('/working', (req, res) => {
      res.status(200).send('<html><body>Working page</body></html>');
    });

    // 404 endpoint
    app.get('/not-found-endpoint', (req, res) => {
      res.status(404).send('<html><body>Not Found</body></html>');
    });

    // 500 endpoint
    app.get('/server-error', (req, res) => {
      res.status(500).send('<html><body>Internal Server Error</body></html>');
    });

    // 403 endpoint
    app.get('/forbidden', (req, res) => {
      res.status(403).send('<html><body>Forbidden</body></html>');
    });

    // 401 endpoint
    app.get('/unauthorized', (req, res) => {
      res.status(401).send('<html><body>Unauthorized</body></html>');
    });

    // Redirect endpoint
    app.get('/redirect-me', (req, res) => {
      res.redirect(302, '/working');
    });

    // Homepage that links to various endpoints
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Test Links</h1>
            <a href="/working">Working Link</a>
            <a href="/not-found">Broken Link (404)</a>
            <a href="/forbidden">Forbidden Link (403)</a>
            <a href="/server-error">Server Error (500)</a>
            <a href="http://this-domain-does-not-exist-12345.com">Dead Domain</a>
            <a href="/redirect-me">Redirect Link</a>
            <img src="/image.png" alt="Test Image">
          </body>
        </html>
      `);
    });

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    server.close();
  });

  test('identifies 404 broken links', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: `${baseUrl}/not-found`, text: 'Broken Link', type: 'link' }
      ]
    }];

    const crawledPages = new Set([`${baseUrl}/`]);
    const result = await checkLinks(pages, crawledPages);

    // Should find the 404
    expect(result.brokenLinks.length).toBeGreaterThan(0);
    const brokenLink = result.brokenLinks.find(bl => bl.url === `${baseUrl}/not-found`);
    expect(brokenLink).toBeDefined();
    expect(brokenLink.status).toBe(404);
  });

  test('identifies 500 server errors as broken', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: `${baseUrl}/server-error`, text: 'Server Error', type: 'link' }
      ]
    }];

    const crawledPages = new Set([`${baseUrl}/`]);
    const result = await checkLinks(pages, crawledPages);

    const brokenLink = result.brokenLinks.find(bl => bl.url === `${baseUrl}/server-error`);
    expect(brokenLink).toBeDefined();
    expect(brokenLink.status).toBe(500);
  });

  test('treats 403/401 as warnings, not broken links', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: `${baseUrl}/forbidden`, text: 'Forbidden', type: 'link' },
        { url: `${baseUrl}/unauthorized`, text: 'Unauthorized', type: 'link' }
      ]
    }];

    const crawledPages = new Set([`${baseUrl}/`]);
    const result = await checkLinks(pages, crawledPages);

    // Should be in warnings, not broken links
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    expect(result.warnings.some(w => w.status === 403)).toBe(true);
    expect(result.warnings.some(w => w.status === 401)).toBe(true);
  });

  test('detects redirects', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: `${baseUrl}/redirect-me`, text: 'Redirect', type: 'link' }
      ]
    }];

    const crawledPages = new Set([`${baseUrl}/`]);
    const result = await checkLinks(pages, crawledPages);

    // Redirect should be tracked
    const redirect = result.redirects.find(r => r.url === `${baseUrl}/redirect-me`);
    expect(redirect).toBeDefined();
    expect(redirect.redirectTo).toBe(`${baseUrl}/working`);
  });

  test('skips internal links that were already crawled', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: `${baseUrl}/working`, text: 'Internal Working', type: 'link' },
        { url: `${baseUrl}/not-found`, text: 'External Broken', type: 'link' }
      ]
    }];

    // Mark /working as already crawled
    const crawledPages = new Set([`${baseUrl}/`, `${baseUrl}/working`]);
    const result = await checkLinks(pages, crawledPages);

    // Should skip the internal link
    expect(result.summary.linksSkipped).toBeGreaterThan(0);

    // Should only check the uncrawled link
    expect(result.brokenLinks.some(bl => bl.url === `${baseUrl}/not-found`)).toBe(true);
  });

  test('handles DNS failures for dead domains', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: 'http://this-domain-definitely-does-not-exist-98765.com/page', text: 'Dead Domain', type: 'link' }
      ]
    }];

    const crawledPages = new Set([`${baseUrl}/`]);
    const result = await checkLinks(pages, crawledPages);

    // Should identify DNS failure
    const brokenLink = result.brokenLinks.find(bl => bl.url.includes('this-domain-definitely-does-not-exist-98765.com'));
    expect(brokenLink).toBeDefined();
    expect(brokenLink.message).toContain('DNS');
  });

  test('provides summary statistics', async () => {
    const pages = [{
      url: `${baseUrl}/`,
      title: 'Test Page',
      links: [
        { url: 'https://example.com/external', text: 'External', type: 'link' },
        { url: `${baseUrl}/not-found`, text: 'Broken', type: 'link' },
        { url: `${baseUrl}/forbidden`, text: 'Forbidden', type: 'link' }
      ]
    }];

    const crawledPages = new Set([`${baseUrl}/`]);
    const result = await checkLinks(pages, crawledPages);

    // Should have proper summary
    expect(result.summary).toBeDefined();
    expect(result.summary.totalPages).toBe(1);
    expect(result.summary.totalLinks).toBe(3);
    expect(result.summary.linksChecked).toBeGreaterThan(0);
    expect(result.summary.brokenLinks).toBeGreaterThan(0);
  });

  test('tracks link occurrences across multiple pages', async () => {
    const sharedBrokenLink = `${baseUrl}/shared-broken-link`;

    const pages = [
      {
        url: `${baseUrl}/page1`,
        title: 'Page 1',
        links: [
          { url: sharedBrokenLink, text: 'From Page 1', type: 'link' }
        ]
      },
      {
        url: `${baseUrl}/page2`,
        title: 'Page 2',
        links: [
          { url: sharedBrokenLink, text: 'From Page 2', type: 'link' }
        ]
      }
    ];

    const crawledPages = new Set([`${baseUrl}/page1`, `${baseUrl}/page2`]);
    const result = await checkLinks(pages, crawledPages);

    // Should find the broken link
    const brokenLink = result.brokenLinks.find(bl => bl.url === sharedBrokenLink);
    expect(brokenLink).toBeDefined();

    // Should track both occurrences
    expect(brokenLink.occurrences.length).toBe(2);
    expect(brokenLink.occurrences.some(o => o.page === `${baseUrl}/page1`)).toBe(true);
    expect(brokenLink.occurrences.some(o => o.page === `${baseUrl}/page2`)).toBe(true);
  });
});
