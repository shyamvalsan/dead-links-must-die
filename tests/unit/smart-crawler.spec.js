const { test, expect } = require('@playwright/test');
const { isSPA } = require('../../smart-crawler');

test.describe('Smart Crawler - SPA Detection', () => {
  test('detects SPA when only 1 page with 0 links found', () => {
    const result = {
      pages: [
        {
          url: 'https://example.com',
          linksCount: 0,
          imagesCount: 0
        }
      ]
    };

    expect(isSPA(result)).toBe(true);
  });

  test('does not detect SPA when multiple pages found', () => {
    const result = {
      pages: [
        { url: 'https://example.com/', linksCount: 5 },
        { url: 'https://example.com/about', linksCount: 3 }
      ]
    };

    expect(isSPA(result)).toBe(false);
  });

  test('does not detect SPA when page has links', () => {
    const result = {
      pages: [
        {
          url: 'https://example.com',
          linksCount: 10,
          imagesCount: 2
        }
      ]
    };

    expect(isSPA(result)).toBe(false);
  });

  test('handles error pages correctly', () => {
    const result = {
      pages: [
        {
          url: 'https://example.com',
          linksCount: 0,
          error: 'Failed to load'
        }
      ]
    };

    expect(isSPA(result)).toBe(true);
  });

  test('handles empty result', () => {
    expect(isSPA(null)).toBe(false);
    expect(isSPA({})).toBe(false);
    expect(isSPA({ pages: [] })).toBe(false);
  });
});
