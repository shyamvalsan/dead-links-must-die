const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const { URL } = require('url');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
const noProxy = (process.env.no_proxy || process.env.NO_PROXY || '').split(',').map(h => h.trim().toLowerCase());

// Check if a hostname should bypass the proxy
function shouldBypassProxy(hostname) {
  if (!proxyUrl) return true;
  const lowerHost = hostname.toLowerCase();
  return noProxy.some(pattern => {
    if (pattern === lowerHost) return true;
    if (pattern.startsWith('*') && lowerHost.endsWith(pattern.slice(1))) return true;
    if (pattern.startsWith('.') && lowerHost.endsWith(pattern)) return true;
    return false;
  });
}

// Fetch content via native https
async function fetchContent(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const useProxy = !shouldBypassProxy(parsedUrl.hostname);
    const agent = useProxy && proxyUrl
      ? (isHttps ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl))
      : undefined;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      agent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)',
        'Accept': 'application/xml,text/xml,*/*',
        'Host': parsedUrl.hostname
      },
      timeout: timeout
    };

    const req = lib.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        res.resume();
        fetchContent(redirectUrl, timeout).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ data, status: res.statusCode }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('ETIMEDOUT'));
    });
    req.end();
  });
}

// Parse sitemap XML and extract URLs
function parseSitemapXML(xml) {
  const urls = [];

  // Simple regex-based XML parsing (good enough for sitemaps)
  const urlRegex = /<loc>(.*?)<\/loc>/g;
  let match;

  while ((match = urlRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

// Check if URL is a sitemap index (references other sitemaps)
function isSitemapIndex(xml) {
  return xml.includes('<sitemapindex') || xml.includes('<sitemap>');
}

// Recursively fetch all URLs from sitemap(s)
async function fetchAllSitemapUrls(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  console.log(`  📄 Fetching sitemap: ${sitemapUrl}`);

  try {
    const { data } = await fetchContent(sitemapUrl);

    // Check if this is a sitemap index pointing to other sitemaps
    if (isSitemapIndex(data)) {
      console.log(`  📋 Sitemap index found, fetching nested sitemaps...`);
      const nestedSitemaps = parseSitemapXML(data);
      let allUrls = [];

      for (const nestedUrl of nestedSitemaps) {
        const urls = await fetchAllSitemapUrls(nestedUrl, visited);
        allUrls = allUrls.concat(urls);
      }

      return allUrls;
    }

    // Regular sitemap with URLs
    const urls = parseSitemapXML(data);
    console.log(`  ✅ Found ${urls.length} URLs in sitemap`);
    return urls;

  } catch (error) {
    console.error(`  ❌ Error fetching sitemap: ${error.message}`);
    return [];
  }
}

// Helper: Extract links and images from HTML
function extractLinksFromHTML(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = [];
  const images = [];

  // Convert relative URLs to absolute
  function toAbsoluteUrl(url, currentPage) {
    try {
      return new URL(url, currentPage).href;
    } catch (e) {
      return null;
    }
  }

  // Extract all links
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (!href) return;

    const absoluteUrl = toAbsoluteUrl(href, pageUrl);
    if (!absoluteUrl) return;

    const text = $(elem).text().trim().substring(0, 100);
    links.push({
      url: absoluteUrl,
      text: text || '(no text)',
      type: 'link'
    });
  });

  // Extract all images
  $('img[src]').each((i, elem) => {
    const src = $(elem).attr('src');
    if (!src) return;

    const absoluteUrl = toAbsoluteUrl(src, pageUrl);
    if (!absoluteUrl) return;

    const alt = $(elem).attr('alt') || '(no alt text)';
    images.push({
      url: absoluteUrl,
      text: alt,
      type: 'image'
    });
  });

  return { links, images };
}

/**
 * Discover pages from sitemap.xml for JavaScript SPAs
 * Fetches each page to extract links for checking
 * @param {string} baseUrl - Base URL of the site (e.g., "https://learn.netdata.cloud")
 * @param {boolean} fetchPages - Whether to fetch each page to extract links (default: true)
 * @returns {Promise<Array>} - Array of page objects with URLs and links
 */
async function discoverFromSitemap(baseUrl, fetchPages = true) {
  console.log(`\n🗺️  Discovering pages from sitemap for: ${baseUrl}`);

  // Use new URL to properly handle port numbers
  const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;

  try {
    const urls = await fetchAllSitemapUrls(sitemapUrl);

    console.log(`\n✅ Sitemap discovery complete: ${urls.length} pages found`);

    if (!fetchPages) {
      // Quick mode: Just return URLs without fetching
      console.log(`⚡ Quick mode: Skipping page fetch\n`);
      return urls.map(url => ({
        url: url,
        title: 'From sitemap',
        links: [],
        linksCount: 0,
        imagesCount: 0,
        source: 'sitemap'
      }));
    }

    // Fetch each page to extract links
    console.log(`📥 Fetching ${urls.length} pages to extract links...`);

    const pages = [];
    const BATCH_SIZE = 10; // Fetch 10 pages at a time

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (url) => {
          try {
            const { data, status } = await fetchContent(url);

            if (status !== 200) {
              return {
                url,
                title: `HTTP ${status}`,
                links: [],
                linksCount: 0,
                imagesCount: 0,
                source: 'sitemap',
                error: `HTTP ${status}`
              };
            }

            const $ = cheerio.load(data);
            const title = $('title').text() || 'Untitled';
            const { links, images } = extractLinksFromHTML(data, url);

            return {
              url,
              title,
              links: [...links, ...images],
              linksCount: links.length,
              imagesCount: images.length,
              source: 'sitemap'
            };
          } catch (error) {
            return {
              url,
              title: 'Error loading page',
              links: [],
              linksCount: 0,
              imagesCount: 0,
              source: 'sitemap',
              error: error.message
            };
          }
        })
      );

      pages.push(...batchResults);

      // Show progress
      if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= urls.length) {
        console.log(`  📊 Progress: ${pages.length}/${urls.length} pages fetched`);
      }
    }

    console.log(`\n✅ Fetched and processed ${pages.length} pages from sitemap\n`);
    return pages;

  } catch (error) {
    console.error(`❌ Failed to fetch sitemap: ${error.message}`);
    return [];
  }
}

module.exports = { discoverFromSitemap, fetchAllSitemapUrls };
