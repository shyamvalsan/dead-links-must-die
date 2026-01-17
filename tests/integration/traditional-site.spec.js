const { test, expect } = require('@playwright/test');
const { smartCrawl } = require('../../smart-crawler');
const express = require('express');

test.describe('Traditional HTML Site Crawling', () => {
  let server;
  let baseUrl;

  // Set up mock server before tests
  test.beforeAll(async () => {
    const app = express();

    // Home page with links
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Home Page</title></head>
          <body>
            <h1>Welcome</h1>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/products">Products</a>
            <img src="/logo.png" alt="Logo">
          </body>
        </html>
      `);
    });

    // About page
    app.get('/about', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>About Us</title></head>
          <body>
            <h1>About</h1>
            <a href="/">Home</a>
            <a href="/team">Team</a>
          </body>
        </html>
      `);
    });

    // Contact page
    app.get('/contact', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Contact</title></head>
          <body>
            <h1>Contact Us</h1>
            <a href="/">Home</a>
          </body>
        </html>
      `);
    });

    // Products page
    app.get('/products', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Products</title></head>
          <body>
            <h1>Our Products</h1>
            <a href="/">Home</a>
            <a href="/products/widget">Widget</a>
          </body>
        </html>
      `);
    });

    // Team page
    app.get('/team', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Team</title></head>
          <body>
            <h1>Our Team</h1>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </body>
        </html>
      `);
    });

    // Product detail
    app.get('/products/widget', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Widget</title></head>
          <body>
            <h1>Widget Details</h1>
            <a href="/">Home</a>
            <a href="/products">Products</a>
          </body>
        </html>
      `);
    });

    server = app.listen(0); // Random port
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    server.close();
  });

  test('discovers all interconnected pages', async () => {
    const result = await smartCrawl(baseUrl);

    expect(result.pages.length).toBeGreaterThanOrEqual(6);
    expect(result.method).toBe('traditional');
    expect(result.isSPA).toBe(false);
  });

  test('extracts links from each page', async () => {
    const result = await smartCrawl(baseUrl);

    const successfulPages = result.pages.filter(p => !p.error);
    expect(successfulPages.length).toBeGreaterThan(0);

    // At least some pages should have links
    const pagesWithLinks = successfulPages.filter(p => p.linksCount > 0);
    expect(pagesWithLinks.length).toBeGreaterThan(0);
  });

  test('handles relative URLs correctly', async () => {
    const result = await smartCrawl(baseUrl);

    // All URLs should be absolute
    for (const page of result.pages) {
      expect(page.url).toMatch(/^http/);

      for (const link of page.links || []) {
        expect(link.url).toMatch(/^http/);
      }
    }
  });

  test('does not duplicate pages', async () => {
    const result = await smartCrawl(baseUrl);

    const urls = result.pages.map(p => p.url);
    const uniqueUrls = new Set(urls);

    expect(urls.length).toBe(uniqueUrls.size);
  });
});
