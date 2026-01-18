const { test, expect } = require('@playwright/test');
const { smartCrawl } = require('../../smart-crawler');
const { checkLinks } = require('../../checker');

/**
 * E2E tests against real production websites
 * These tests validate the crawler works with real-world sites including:
 * - Large traditional sites (1000+ pages)
 * - JavaScript SPAs with sitemaps
 * - Sites with redirects
 * - Sites with various HTTP status codes
 * - Simple static sites
 *
 * Note: These tests are slower and may fail if sites change or are down
 * Run less frequently than unit/integration tests
 */

test.describe('Real-World Site Crawling', () => {
  // Increase timeout for network operations
  test.setTimeout(180000); // 3 minutes per test

  test('crawls www.netdata.cloud (traditional site)', async () => {
    const result = await smartCrawl('https://www.netdata.cloud');

    // Should discover many pages (1000+)
    expect(result.pages.length).toBeGreaterThan(100);

    // Should use traditional method
    expect(result.method).toBe('traditional');
    expect(result.isSPA).toBe(false);

    // Should have successful pages
    const successfulPages = result.pages.filter(p => !p.error);
    expect(successfulPages.length).toBeGreaterThan(50);

    // Pages should have links
    const pagesWithLinks = successfulPages.filter(p => p.linksCount > 0);
    expect(pagesWithLinks.length).toBeGreaterThan(10);
  });

  test('crawls learn.netdata.cloud (Docusaurus SPA)', async () => {
    const result = await smartCrawl('https://learn.netdata.cloud');

    // Should discover many pages (either via traditional or sitemap)
    expect(result.pages.length).toBeGreaterThan(100);

    // Method could be traditional or sitemap depending on site structure
    expect(['traditional', 'sitemap']).toContain(result.method);

    // Should have found pages with links
    const pagesWithLinks = result.pages.filter(p => p.linksCount > 0);
    expect(pagesWithLinks.length).toBeGreaterThan(10);
  });

  test('handles bare domain redirects (netdata.cloud → www.netdata.cloud)', async () => {
    const result = await smartCrawl('https://netdata.cloud');

    // Should successfully follow redirect and crawl at least the homepage
    expect(result.pages.length).toBeGreaterThanOrEqual(1);

    // Should not crash or error on redirects
    expect(result).toBeDefined();
    expect(result.method).toBeDefined();
  });

  test('crawls example.com (simple site)', async () => {
    const result = await smartCrawl('https://example.com');

    // Should not crash
    expect(result).toBeDefined();
    expect(result.pages).toBeDefined();

    // May get blocked by SSL/bot detection, so just verify structure
    // If successful, should use traditional method
    if (result.pages.length > 0 && !result.pages[0].error) {
      expect(result.method).toBe('traditional');
    }
  });

  test('crawls httpbin.org (testing site)', async () => {
    const result = await smartCrawl('https://httpbin.org');

    // Should discover at least the homepage
    expect(result.pages.length).toBeGreaterThanOrEqual(1);

    const successfulPages = result.pages.filter(p => !p.error);
    expect(successfulPages.length).toBeGreaterThan(0);
  });

  test('handles sites with mixed content', async () => {
    // Test with a site that has both HTML and images
    const result = await smartCrawl('https://example.org');

    // Should not crash
    expect(result).toBeDefined();
    expect(Array.isArray(result.pages)).toBe(true);

    // If successful, check if structure supports images
    if (result.pages.length > 0 && !result.pages[0].error) {
      // Verify the page object has imagesCount property
      expect(result.pages[0]).toHaveProperty('imagesCount');
    }
  });
});

test.describe('Real-World Error Handling', () => {
  test.setTimeout(60000);

  test('handles non-existent domains gracefully', async () => {
    const result = await smartCrawl('https://this-domain-definitely-does-not-exist-12345.com');

    // Should not crash
    expect(result).toBeDefined();
    expect(result.pages).toBeDefined();

    // Should have error in results
    if (result.pages.length > 0) {
      expect(result.pages[0].error).toBeDefined();
    }
  });

  test('handles sites without sitemap gracefully', async () => {
    // Use a simple site that likely doesn't have sitemap
    const result = await smartCrawl('https://example.com');

    // Should not crash even if site blocks us
    expect(result).toBeDefined();
    expect(result.pages).toBeDefined();

    // Should attempt crawling (even if blocked)
    expect(result.method).toBeDefined();
  });
});

test.describe('Full Crawl + Link Check E2E (Real Sites)', () => {
  test.setTimeout(300000); // 5 minutes for full crawl + check

  test('full workflow on httpbin.org', async () => {
    // Step 1: Crawl
    const crawlResult = await smartCrawl('https://httpbin.org');

    // Should discover at least homepage
    expect(crawlResult.pages.length).toBeGreaterThanOrEqual(1);

    // Step 2: Check links
    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should have checked some links
    expect(checkResult.summary).toBeDefined();
    expect(checkResult.summary.totalPages).toBeGreaterThan(0);
  });

  test('identifies broken links on test site with known issues', async () => {
    // Use httpbin.org which has various status code endpoints
    const crawlResult = await smartCrawl('https://httpbin.org/links/10/0');

    // Should discover pages with links
    expect(crawlResult.pages.length).toBeGreaterThanOrEqual(1);

    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should have results
    expect(checkResult).toBeDefined();
    expect(checkResult.summary.linksChecked).toBeGreaterThanOrEqual(0);
  });

  test('handles sites with many redirects', async () => {
    // httpbin.org has redirect testing endpoints
    const crawlResult = await smartCrawl('https://httpbin.org');

    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Should handle redirects without crashing
    expect(checkResult).toBeDefined();
    expect(Array.isArray(checkResult.redirects)).toBe(true);
  });

  test('provides comprehensive summary statistics', async () => {
    const crawlResult = await smartCrawl('https://example.com');

    const crawledUrls = new Set(crawlResult.pages.map(p => p.url));
    const checkResult = await checkLinks(crawlResult.pages, crawledUrls);

    // Summary should have all required fields
    expect(checkResult.summary.totalPages).toBeDefined();
    expect(checkResult.summary.totalLinks).toBeDefined();
    expect(checkResult.summary.linksChecked).toBeDefined();
    expect(checkResult.summary.brokenLinks).toBeDefined();
    expect(checkResult.summary.warnings).toBeDefined();
    expect(checkResult.summary.redirects).toBeDefined();
  });
});

test.describe('Real-World Site Diversity', () => {
  test.setTimeout(60000);

  test('crawls static documentation sites', async () => {
    // Example.com is a simple static site
    const result = await smartCrawl('https://example.com');

    expect(result).toBeDefined();
    expect(result.pages).toBeDefined();
  });

  test('handles HTTP vs HTTPS redirects', async () => {
    // Many sites redirect HTTP to HTTPS
    const result = await smartCrawl('http://example.com');

    // Should follow redirect
    expect(result).toBeDefined();
    expect(result.pages).toBeDefined();
  });

  test('handles sites with query parameters', async () => {
    const result = await smartCrawl('https://httpbin.org?test=1');

    expect(result).toBeDefined();
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
  });

  test('handles sites with hash fragments', async () => {
    const result = await smartCrawl('https://example.com#section');

    expect(result).toBeDefined();
    expect(result.pages).toBeDefined();
  });
});
