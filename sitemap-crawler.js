const https = require('https');
const http = require('http');
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

/**
 * Discover pages from sitemap.xml for JavaScript SPAs
 * @param {string} baseUrl - Base URL of the site (e.g., "https://learn.netdata.cloud")
 * @returns {Promise<Array>} - Array of page objects with URLs
 */
async function discoverFromSitemap(baseUrl) {
  console.log(`\n🗺️  Discovering pages from sitemap for: ${baseUrl}`);

  const parsedUrl = new URL(baseUrl);
  const sitemapUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/sitemap.xml`;

  try {
    const urls = await fetchAllSitemapUrls(sitemapUrl);

    console.log(`\n✅ Sitemap discovery complete: ${urls.length} pages found\n`);

    // Convert to page objects compatible with crawler format
    return urls.map(url => ({
      url: url,
      title: 'From sitemap',
      links: [],
      linksCount: 0,
      imagesCount: 0,
      source: 'sitemap'
    }));

  } catch (error) {
    console.error(`❌ Failed to fetch sitemap: ${error.message}`);
    return [];
  }
}

module.exports = { discoverFromSitemap, fetchAllSitemapUrls };
