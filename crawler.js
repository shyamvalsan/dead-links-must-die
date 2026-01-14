const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Crawl a website and discover all pages, links, and images
 */
async function crawlWebsite(startUrl, onProgress) {
  const baseUrl = new URL(startUrl);
  const visited = new Set();
  const toVisit = [startUrl];
  const pages = [];

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

  while (toVisit.length > 0) {
    const currentUrl = toVisit.shift();
    const normalizedUrl = normalizeUrl(currentUrl);

    if (!normalizedUrl || visited.has(normalizedUrl)) {
      continue;
    }

    visited.add(normalizedUrl);

    // Update progress
    if (onProgress) {
      onProgress({
        pagesFound: visited.size,
        pagesCrawled: pages.length
      });
    }

    try {
      // Fetch the page
      const response = await axios.get(normalizedUrl, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'DeadLinksMustDie/1.0'
        }
      });

      // Only process HTML pages
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        continue;
      }

      const html = response.data;
      const $ = cheerio.load(html);

      const links = [];
      const images = [];

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
          if (normalized && !visited.has(normalized) && !toVisit.includes(absoluteUrl)) {
            toVisit.push(absoluteUrl);
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

      pages.push({
        url: normalizedUrl,
        title: $('title').text() || 'Untitled',
        links: [...links, ...images],
        linksCount: links.length,
        imagesCount: images.length
      });

    } catch (error) {
      // Page failed to load, we'll check it properly in the checker
      pages.push({
        url: normalizedUrl,
        title: 'Error loading page',
        links: [],
        linksCount: 0,
        imagesCount: 0,
        error: error.message
      });
    }

    // Limit to prevent infinite crawling (safety measure)
    if (visited.size >= 500) {
      console.log('Reached page limit (500), stopping crawl');
      break;
    }
  }

  // Update final progress
  if (onProgress) {
    onProgress({
      pagesFound: visited.size,
      pagesCrawled: pages.length
    });
  }

  return pages;
}

module.exports = { crawlWebsite };
