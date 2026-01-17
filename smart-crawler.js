const { crawlWebsite } = require('./crawler');
const { discoverFromSitemap } = require('./sitemap-crawler');

/**
 * Intelligent crawler that automatically handles both traditional sites and SPAs
 *
 * Strategy:
 * 1. Try traditional HTML crawling first (fast, works for 95% of sites)
 * 2. Detect if site is a SPA (only 1 page with 0 links found)
 * 3. Automatically fallback to sitemap.xml discovery
 * 4. Return best available results
 *
 * @param {string} startUrl - URL to start crawling
 * @param {function} onProgress - Progress callback
 * @param {function} onPageCrawled - Page crawled callback
 * @returns {Promise<Object>} - Crawl results with method indicator
 */
async function smartCrawl(startUrl, onProgress, onPageCrawled) {
  console.log(`\n🔍 Starting intelligent crawl of ${startUrl}`);

  // Step 1: Try traditional crawling first
  console.log(`📊 Attempting traditional HTML crawling...`);

  const traditionalResult = await crawlWebsite(startUrl, onProgress, onPageCrawled);
  const { pages } = traditionalResult;

  // Step 2: Check if we got meaningful results
  const successfulPages = pages.filter(p => !p.error);
  const hasLinks = successfulPages.some(p => p.linksCount > 0);

  // Success criteria: Multiple pages OR at least one page with links
  if (pages.length > 1 || hasLinks) {
    console.log(`✅ Traditional crawling successful: ${pages.length} pages discovered`);
    return {
      ...traditionalResult,
      method: 'traditional',
      isSPA: false
    };
  }

  // Step 3: Looks like a SPA - try sitemap
  console.log(`\n🔍 SPA detected (${pages.length} page, 0 links)`);
  console.log(`📋 Attempting sitemap.xml discovery...`);

  try {
    const sitemapPages = await discoverFromSitemap(startUrl);

    if (sitemapPages.length > 1) {
      console.log(`✅ Sitemap crawling successful: ${sitemapPages.length} pages discovered`);

      // Notify about each sitemap page if callback provided
      if (onPageCrawled) {
        sitemapPages.forEach(page => onPageCrawled(page));
      }

      return {
        pages: sitemapPages,
        crawledUrls: new Set(sitemapPages.map(p => p.url)),
        method: 'sitemap',
        isSPA: true
      };
    } else {
      console.log(`⚠️  Sitemap found but contained no additional pages`);
    }
  } catch (error) {
    console.log(`⚠️  Sitemap crawling failed: ${error.message}`);
  }

  // Step 4: Both methods failed - return traditional results with warning
  console.log(`⚠️  Unable to discover additional pages`);
  console.log(`   This may be a SPA without a sitemap.xml`);
  console.log(`   Consider using a headless browser (Puppeteer) for complete coverage`);

  return {
    ...traditionalResult,
    method: 'traditional',
    isSPA: true,
    warning: 'Possible SPA without sitemap - limited coverage'
  };
}

/**
 * Helper function to check if a site is likely a SPA
 *
 * A site is considered a SPA if:
 * - Only 1 page was discovered, AND
 * - That page has an error (can't determine link count), OR
 * - That page has 0 links (typical of SPAs where links are JS-generated)
 */
function isSPA(crawlResult) {
  if (!crawlResult || !crawlResult.pages) return false;

  // Only 1 page discovered
  if (crawlResult.pages.length !== 1) return false;

  const page = crawlResult.pages[0];

  // If page has error, can't determine - but should try sitemap fallback
  if (page.error) return true;

  // If page has no links, likely SPA
  return page.linksCount === 0;
}

module.exports = {
  smartCrawl,
  isSPA,
  // Re-export individual crawlers for flexibility
  crawlWebsite,
  discoverFromSitemap
};
