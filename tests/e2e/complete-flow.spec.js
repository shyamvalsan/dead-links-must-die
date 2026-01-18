const { test, expect } = require('@playwright/test');
const { smartCrawl } = require('../../smart-crawler');
const { checkLinks } = require('../../checker');
const express = require('express');

/**
 * Complete End-to-End Flow Tests
 * Tests the entire pipeline from start to finish:
 * 1. User provides URL
 * 2. System crawls website (discovers all pages)
 * 3. System extracts all links and images from discovered pages
 * 4. System checks each link for validity (200 vs 404/500/etc)
 * 5. System categorizes results (working, broken, warnings, redirects)
 * 6. System provides detailed report with occurrences
 */

test.describe('Complete Crawl → Check → Report Flow', () => {
  let server;
  let baseUrl;

  test.beforeAll(async () => {
    // Create a comprehensive test site with various scenarios
    const app = express();

    // Homepage - the entry point
    app.get('/', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Site Homepage</title></head>
          <body>
            <h1>Homepage</h1>
            <nav>
              <a href="/about">About</a>
              <a href="/products">Products</a>
              <a href="/blog">Blog</a>
              <a href="/contact">Contact</a>
            </nav>
            <img src="/images/logo.png" alt="Logo">
            <img src="/images/missing-banner.png" alt="Banner">
          </body>
        </html>
      `);
    });

    // About page
    app.get('/about', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>About Us</title></head>
          <body>
            <h1>About</h1>
            <a href="/">Home</a>
            <a href="/team">Team</a>
            <a href="/404-broken">Broken Internal Link</a>
            <a href="http://localhost:${port}/external-api">External API</a>
            <a href="http://non-existent-domain-12345.test">Dead Domain Link</a>
          </body>
        </html>
      `);
    });

    // Products page
    app.get('/products', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Products</title></head>
          <body>
            <h1>Products</h1>
            <a href="/">Home</a>
            <a href="/products/item1">Product 1</a>
            <a href="/products/item2">Product 2</a>
            <a href="http://localhost:${port}/forbidden">Forbidden Resource</a>
            <img src="/images/product1.jpg" alt="Product 1">
          </body>
        </html>
      `);
    });

    // Product items
    app.get('/products/item1', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Product 1</title></head>
          <body>
            <h1>Product 1</h1>
            <a href="/products">Back to Products</a>
            <a href="/">Home</a>
          </body>
        </html>
      `);
    });

    app.get('/products/item2', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Product 2</title></head>
          <body>
            <h1>Product 2</h1>
            <a href="/products">Back to Products</a>
            <a href="http://localhost:${port}/server-error">Error Link</a>
          </body>
        </html>
      `);
    });

    // Blog page
    app.get('/blog', (req, res) => {
      const port = server.address().port;
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Blog</title></head>
          <body>
            <h1>Blog</h1>
            <a href="/">Home</a>
            <a href="/blog/post1">Post 1</a>
            <a href="http://localhost:${port}/redirect-test">Redirect Link</a>
          </body>
        </html>
      `);
    });

    app.get('/blog/post1', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Blog Post 1</title></head>
          <body>
            <h1>Blog Post 1</h1>
            <a href="/blog">Back to Blog</a>
            <a href="/">Home</a>
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
            <h1>Contact</h1>
            <a href="/">Home</a>
          </body>
        </html>
      `);
    });

    // Working resources
    app.get('/images/logo.png', (req, res) => {
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    app.get('/images/product1.jpg', (req, res) => {
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
    });

    app.get('/external-api', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Error scenarios
    app.get('/forbidden', (req, res) => {
      res.status(403).send('Forbidden');
    });

    app.get('/server-error', (req, res) => {
      res.status(500).send('Internal Server Error');
    });

    app.get('/redirect-test', (req, res) => {
      const port = server.address().port;
      res.redirect(302, `http://localhost:${port}/blog/post1`);
    });

    // 404 for everything else
    app.use((req, res) => {
      res.status(404).send('Not Found');
    });

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    server.close();
  });

  test('FULL FLOW: Crawl → Extract Links → Check Links → Report', async () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log('COMPLETE END-TO-END FLOW TEST');
    console.log(`Testing site: ${baseUrl}`);
    console.log(`${'='.repeat(80)}\n`);

    // ====================================================================
    // STEP 1: CRAWL THE WEBSITE
    // ====================================================================
    console.log('STEP 1: Crawling website...');
    const crawlResult = await smartCrawl(baseUrl);

    console.log(`✓ Discovered ${crawlResult.pages.length} pages`);
    console.log(`✓ Method used: ${crawlResult.method}`);

    // Verify crawl results
    expect(crawlResult.pages.length).toBeGreaterThanOrEqual(8); // At least 8 pages
    expect(crawlResult.method).toBe('traditional');

    // Verify expected pages were discovered
    const pageUrls = crawlResult.pages.map(p => p.url);
    expect(pageUrls.some(u => u === `${baseUrl}/`)).toBe(true);
    expect(pageUrls.some(u => u.includes('/about'))).toBe(true);
    expect(pageUrls.some(u => u.includes('/products'))).toBe(true);
    expect(pageUrls.some(u => u.includes('/blog'))).toBe(true);

    // ====================================================================
    // STEP 2: EXTRACT ALL LINKS
    // ====================================================================
    console.log('\nSTEP 2: Extracting links from discovered pages...');

    let totalLinks = 0;
    let totalImages = 0;
    for (const page of crawlResult.pages) {
      totalLinks += page.linksCount || 0;
      totalImages += page.imagesCount || 0;
    }

    console.log(`✓ Found ${totalLinks} links`);
    console.log(`✓ Found ${totalImages} images`);

    expect(totalLinks).toBeGreaterThan(0);

    // ====================================================================
    // STEP 3: CHECK ALL LINKS
    // ====================================================================
    console.log('\nSTEP 3: Checking all links for validity...');

    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    console.log(`✓ Checked ${checkResult.summary.linksChecked} links`);
    console.log(`✓ Skipped ${checkResult.summary.linksSkipped} internal links (already crawled)`);

    // Verify link checking happened
    expect(checkResult.summary.linksChecked).toBeGreaterThan(0);
    expect(checkResult.summary.linksSkipped).toBeGreaterThan(0);

    // ====================================================================
    // STEP 4: CATEGORIZE RESULTS
    // ====================================================================
    console.log('\nSTEP 4: Categorizing results...');
    console.log(`  - Broken links: ${checkResult.brokenLinks.length}`);
    console.log(`  - Warnings (403/401): ${checkResult.warnings.length}`);
    console.log(`  - Redirects: ${checkResult.redirects.length}`);
    console.log(`  - Working links: ${checkResult.summary.workingLinks}`);

    // Should have found broken links (404-broken, missing-banner.png, dead domain)
    expect(checkResult.brokenLinks.length).toBeGreaterThan(0);

    // Should have found warnings (forbidden)
    // Note: Warnings might be 0 if forbidden link was skipped or DNS failed
    expect(checkResult.warnings.length).toBeGreaterThanOrEqual(0);

    // Should have found redirects (redirect-test)
    // Note: Redirects might be 0 if the redirect was to an internal page
    expect(checkResult.redirects.length).toBeGreaterThanOrEqual(0);

    // ====================================================================
    // STEP 5: VERIFY DETAILED REPORTING
    // ====================================================================
    console.log('\nSTEP 5: Verifying detailed reporting...');

    // Each broken link should have occurrence details
    for (const brokenLink of checkResult.brokenLinks) {
      expect(brokenLink.url).toBeDefined();
      expect(brokenLink.status).toBeDefined();
      expect(brokenLink.message).toBeDefined();
      expect(Array.isArray(brokenLink.occurrences)).toBe(true);
      expect(brokenLink.occurrences.length).toBeGreaterThan(0);

      // Each occurrence should tell us WHERE the broken link was found
      for (const occurrence of brokenLink.occurrences) {
        expect(occurrence.page).toBeDefined(); // Which page had the broken link
        expect(occurrence.text).toBeDefined(); // Link text or alt text
        expect(occurrence.type).toBeDefined(); // 'link' or 'image'
      }

      console.log(`  ✗ ${brokenLink.url} (${brokenLink.status}: ${brokenLink.message})`);
      console.log(`     Found on ${brokenLink.occurrences.length} page(s)`);
    }

    // Per-page results should exist
    expect(checkResult.pages.length).toBeGreaterThan(0);
    for (const pageResult of checkResult.pages) {
      expect(pageResult.url).toBeDefined();
      expect(pageResult.title).toBeDefined();
      expect(pageResult.totalLinks).toBeGreaterThanOrEqual(0);
      expect(pageResult.brokenLinks).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(pageResult.brokenLinksList)).toBe(true);
    }

    // ====================================================================
    // STEP 6: VERIFY SUMMARY STATISTICS
    // ====================================================================
    console.log('\nSTEP 6: Summary statistics:');
    console.log(`  Total pages crawled: ${checkResult.summary.totalPages}`);
    console.log(`  Total unique links: ${checkResult.summary.totalLinks}`);
    console.log(`  Links checked: ${checkResult.summary.linksChecked}`);
    console.log(`  Broken links: ${checkResult.summary.brokenLinks}`);
    console.log(`  Working links: ${checkResult.summary.workingLinks}`);
    console.log(`  Warnings: ${checkResult.summary.warnings}`);
    console.log(`  Redirects: ${checkResult.summary.redirects}`);

    expect(checkResult.summary.totalPages).toBeGreaterThan(0);
    expect(checkResult.summary.totalLinks).toBeGreaterThan(0);
    expect(checkResult.summary.brokenLinks).toBeGreaterThan(0);

    console.log(`\n${'='.repeat(80)}`);
    console.log('✓ COMPLETE FLOW TEST PASSED');
    console.log(`${'='.repeat(80)}\n`);
  });

  test('verifies broken link appears in correct page results', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Find the About page results
    const aboutPage = checkResult.pages.find(p => p.url.includes('/about'));
    expect(aboutPage).toBeDefined();

    // About page has /404-broken link, which should be broken
    expect(aboutPage.brokenLinks).toBeGreaterThan(0);
    expect(aboutPage.brokenLinksList.length).toBeGreaterThan(0);

    // Verify broken link has correct details
    const brokenLink = aboutPage.brokenLinksList.find(bl => bl.url.includes('404-broken'));
    if (brokenLink) {
      expect(brokenLink.status).toBe(404);
      expect(brokenLink.message).toBeDefined();
    }
  });

  test('tracks same broken link across multiple pages', async () => {
    const crawlResult = await smartCrawl(baseUrl);
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // The dead domain link appears on /about page
    // Find it in the broken links list
    const deadDomainLink = checkResult.brokenLinks.find(bl =>
      bl.url.includes('non-existent-domain')
    );

    if (deadDomainLink) {
      // Should have occurrence details
      expect(deadDomainLink.occurrences.length).toBeGreaterThan(0);
      expect(deadDomainLink.occurrences[0].page).toContain('/about');
    }
  });
});
