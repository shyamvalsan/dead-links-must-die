const { test, expect } = require('@playwright/test');
const { smartCrawl } = require('../../smart-crawler');

/**
 * E2E tests against real production websites
 * These tests validate the crawler works with real-world sites
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

    // Should detect SPA and use sitemap
    expect(result.method).toBe('sitemap');
    expect(result.isSPA).toBe(true);

    // Should discover many pages from sitemap (500+)
    expect(result.pages.length).toBeGreaterThan(100);

    // Pages should have links (because we fetch them)
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
