const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// Configuration
const CRAWL_CONCURRENCY = 20; // Crawl 20 pages simultaneously (reduced to avoid rate limits)
const CRAWL_TIMEOUT = 12000; // 12 seconds per page (increased for reliability)
const MAX_PAGES = 10000; // Much higher limit (10k pages)

/**
 * Crawl a website and discover all pages, links, and images with massive parallelization
 */
async function crawlWebsite(startUrl, onProgress, onPageCrawled) {
  const baseUrl = new URL(startUrl);
  const visited = new Set();
  const toVisit = [startUrl];
  const pages = [];
  const crawling = new Set(); // Track pages currently being crawled

  // Normalize URL (remove fragments, trailing slashes)
  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      let normalized = parsed.href;
      if (normalized.endsWith('/') && parsed.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch (e) {
      return null;
    }
  }

  // Check if URL is internal (same domain)
  function isInternalUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === baseUrl.hostname;
    } catch (e) {
      return false;
    }
  }

  // Convert relative URL to absolute
  function toAbsoluteUrl(url, currentPage) {
    try {
      return new URL(url, currentPage).href;
    } catch (e) {
      return null;
    }
  }

  // Crawl a single page
  async function crawlPage(url) {
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl || visited.has(normalizedUrl) || crawling.has(normalizedUrl)) {
      return null;
    }

    visited.add(normalizedUrl);
    crawling.add(normalizedUrl);

    try {
      // Fetch the page
      const response = await axios.get(normalizedUrl, {
        timeout: CRAWL_TIMEOUT,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)'
        }
      });

      // Only process HTML pages
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        crawling.delete(normalizedUrl);
        return null;
      }

      const html = response.data;
      const $ = cheerio.load(html);

      const links = [];
      const images = [];
      const newInternalLinks = [];

      // Extract all links
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (!href) return;

        const absoluteUrl = toAbsoluteUrl(href, normalizedUrl);
        if (!absoluteUrl) return;

        const text = $(elem).text().trim().substring(0, 100);
        links.push({
          url: absoluteUrl,
          text: text || '(no text)',
          type: 'link'
        });

        // Add internal links to crawl queue
        if (isInternalUrl(absoluteUrl)) {
          const normalized = normalizeUrl(absoluteUrl);
          if (normalized && !visited.has(normalized) && !crawling.has(normalized)) {
            if (!toVisit.includes(absoluteUrl)) {
              toVisit.push(absoluteUrl);
              newInternalLinks.push(absoluteUrl);
            }
          }
        }
      });

      // Extract all images
      $('img[src]').each((i, elem) => {
        const src = $(elem).attr('src');
        if (!src) return;

        const absoluteUrl = toAbsoluteUrl(src, normalizedUrl);
        if (!absoluteUrl) return;

        const alt = $(elem).attr('alt') || '(no alt text)';
        images.push({
          url: absoluteUrl,
          text: alt,
          type: 'image'
        });
      });

      const pageData = {
        url: normalizedUrl,
        title: $('title').text() || 'Untitled',
        links: [...links, ...images],
        linksCount: links.length,
        imagesCount: images.length
      };

      pages.push(pageData);
      crawling.delete(normalizedUrl);

      // Callback for pipeline processing
      if (onPageCrawled) {
        onPageCrawled(pageData);
      }

      return pageData;

    } catch (error) {
      // Page failed to load
      const pageData = {
        url: normalizedUrl,
        title: 'Error loading page',
        links: [],
        linksCount: 0,
        imagesCount: 0,
        error: error.message
      };

      pages.push(pageData);
      crawling.delete(normalizedUrl);

      if (onPageCrawled) {
        onPageCrawled(pageData);
      }

      return pageData;
    }
  }

  // Main crawling loop with parallel processing
  while (toVisit.length > 0 || crawling.size > 0) {
    // Update progress
    if (onProgress) {
      onProgress({
        pagesFound: visited.size + toVisit.length,
        pagesCrawled: pages.length
      });
    }

    // Check if we hit the limit
    if (visited.size >= MAX_PAGES) {
      console.log(`Reached page limit (${MAX_PAGES}), stopping crawl`);
      break;
    }

    // Get next batch to crawl
    const batchSize = Math.min(CRAWL_CONCURRENCY - crawling.size, toVisit.length);
    if (batchSize <= 0) {
      // Wait a bit for current crawls to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    const batch = toVisit.splice(0, batchSize);

    // Start crawling all pages in batch (don't wait)
    const crawlPromises = batch.map(url => crawlPage(url));

    // Wait for at least one to complete before continuing
    await Promise.race([
      Promise.all(crawlPromises),
      new Promise(resolve => setTimeout(resolve, 100))
    ]);
  }

  // Wait for any remaining crawls to complete
  while (crawling.size > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Update final progress
  if (onProgress) {
    onProgress({
      pagesFound: visited.size,
      pagesCrawled: pages.length
    });
  }

  console.log(`✅ Crawled ${pages.length} pages, found ${visited.size} unique URLs`);

  return { pages, crawledUrls: visited };
}

module.exports = { crawlWebsite };
