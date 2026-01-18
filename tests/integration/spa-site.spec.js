const { test, expect } = require('@playwright/test');
const { smartCrawl } = require('../../smart-crawler');
const express = require('express');

test.describe('SPA Site with Sitemap', () => {
  let server;
  let baseUrl;

  test.beforeAll(async () => {
    const app = express();

    // SPA homepage (empty, JavaScript-rendered)
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>SPA Site</title></head>
          <body>
            <div id="root"></div>
            <script src="/bundle.js"></script>
          </body>
        </html>
      `);
    });

    // Sitemap with actual pages
    app.get('/sitemap.xml', (req, res) => {
      res.set('Content-Type', 'application/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:${server.address().port}/docs/intro</loc></url>
  <url><loc>http://localhost:${server.address().port}/docs/guide</loc></url>
  <url><loc>http://localhost:${server.address().port}/docs/api</loc></url>
</urlset>`);
    });

    // Actual doc pages (server-rendered for SEO)
    app.get('/docs/intro', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Introduction</title></head>
          <body>
            <h1>Introduction</h1>
            <a href="/docs/guide">Next: Guide</a>
            <img src="/logo.png" alt="Logo">
          </body>
        </html>
      `);
    });

    app.get('/docs/guide', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Guide</title></head>
          <body>
            <h1>Guide</h1>
            <a href="/docs/intro">Previous</a>
            <a href="/docs/api">Next: API</a>
          </body>
        </html>
      `);
    });

    app.get('/docs/api', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>API Reference</title></head>
          <body>
            <h1>API Reference</h1>
            <a href="/docs/guide">Previous</a>
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

  test('detects SPA and falls back to sitemap', async () => {
    const result = await smartCrawl(baseUrl);

    expect(result.method).toBe('sitemap');
    expect(result.isSPA).toBe(true);
  });

  test('discovers pages from sitemap', async () => {
    const result = await smartCrawl(baseUrl);

    // Should find sitemap pages (not just homepage)
    expect(result.pages.length).toBeGreaterThan(1);

    const urls = result.pages.map(p => p.url);
    expect(urls.some(u => u.includes('/docs/intro'))).toBe(true);
    expect(urls.some(u => u.includes('/docs/guide'))).toBe(true);
    expect(urls.some(u => u.includes('/docs/api'))).toBe(true);
  });

  test('fetches sitemap pages and extracts links', async () => {
    const result = await smartCrawl(baseUrl);

    // Pages should have links (because we fetch them)
    const pagesWithLinks = result.pages.filter(p => p.linksCount > 0);
    expect(pagesWithLinks.length).toBeGreaterThan(0);
  });

  test('extracts correct page titles from sitemap pages', async () => {
    const result = await smartCrawl(baseUrl);

    const introPage = result.pages.find(p => p.url.includes('/docs/intro'));
    expect(introPage).toBeDefined();
    expect(introPage.title).toContain('Introduction');
  });
});
