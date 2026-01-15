const axios = require('axios');
const http = require('http');
const https = require('https');

// Configuration
const CONCURRENCY = 500; // Check 500 links simultaneously (5x increase!)
const TIMEOUT = 5000; // 5 seconds (more reasonable to avoid false positives)

// Connection pooling for massive performance boost
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 500,
  maxFreeSockets: 100,
  timeout: TIMEOUT
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 500,
  maxFreeSockets: 100,
  timeout: TIMEOUT
});

/**
 * Check all links and images for broken/dead links with massive parallelization
 */
async function checkLinks(pages, crawledPages, onProgress, onBrokenLinkFound) {
  // Collect all unique links to check
  const linksToCheck = new Map(); // url -> [{ page, linkData }]

  for (const page of pages) {
    for (const link of page.links) {
      if (!linksToCheck.has(link.url)) {
        linksToCheck.set(link.url, []);
      }
      linksToCheck.get(link.url).push({
        page: page.url,
        link
      });
    }
  }

  // Filter out internal links we already crawled (they're valid!)
  const linksToCheckArray = Array.from(linksToCheck.entries());
  const filteredLinks = linksToCheckArray.filter(([url]) => !crawledPages.has(url));

  console.log(`📊 Total unique links: ${linksToCheckArray.length}`);
  console.log(`✅ Skipping ${linksToCheckArray.length - filteredLinks.length} internal links (already crawled)`);
  console.log(`🔍 Checking ${filteredLinks.length} external/uncrawled links`);

  const results = {
    summary: {
      totalPages: pages.length,
      totalLinks: linksToCheckArray.length,
      linksChecked: 0,
      linksSkipped: linksToCheckArray.length - filteredLinks.length,
      brokenLinks: 0,
      workingLinks: 0,
      redirects: 0,
      warnings: 0
    },
    pages: [],
    brokenLinks: [],
    redirects: [],
    warnings: [] // 403s and other access-denied
  };

  let checked = 0;
  let broken = 0;

  // Process links in batches with massive concurrency
  for (let i = 0; i < filteredLinks.length; i += CONCURRENCY) {
    const batch = filteredLinks.slice(i, i + CONCURRENCY);

    // Check all links in this batch simultaneously
    const checkPromises = batch.map(async ([url, occurrences]) => {
      const checkResult = await checkUrl(url);

      checked++;

      // Update progress
      if (onProgress) {
        onProgress({ checked: checked + results.summary.linksSkipped, broken });
      }

      if (!checkResult.ok) {
        // Treat 403/401 as warnings (site blocking crawlers, but may work for users)
        if (checkResult.status === 403 || checkResult.status === 401) {
          const warningData = {
            url,
            status: checkResult.status,
            message: checkResult.message + ' (may be accessible to users)',
            occurrences: occurrences.map(o => ({
              page: o.page,
              text: o.link.text,
              type: o.link.type
            }))
          };
          results.warnings.push(warningData);
        } else {
          // Real broken link
          broken++;
          const brokenLinkData = {
            url,
            status: checkResult.status,
            message: checkResult.message,
            occurrences: occurrences.map(o => ({
              page: o.page,
              text: o.link.text,
              type: o.link.type
            }))
          };
          results.brokenLinks.push(brokenLinkData);

          // Immediately notify about broken link (real-time!)
          if (onBrokenLinkFound) {
            onBrokenLinkFound(brokenLinkData);
          }
        }
      } else if (checkResult.redirected && !isTrivialRedirect(url, checkResult.finalUrl)) {
        // Only report non-trivial redirects
        results.redirects.push({
          url,
          redirectTo: checkResult.finalUrl,
          occurrences: occurrences.map(o => ({
            page: o.page,
            text: o.link.text,
            type: o.link.type
          }))
        });
      }
    });

    // Wait for this batch to complete before moving to next
    await Promise.all(checkPromises);
  }

  // Organize results by page
  for (const page of pages) {
    const pageBrokenLinks = [];

    for (const link of page.links) {
      const brokenLink = results.brokenLinks.find(bl => bl.url === link.url);
      if (brokenLink) {
        pageBrokenLinks.push({
          url: link.url,
          text: link.text,
          type: link.type,
          status: brokenLink.status,
          message: brokenLink.message
        });
      }
    }

    results.pages.push({
      url: page.url,
      title: page.title,
      totalLinks: page.links.length,
      brokenLinks: pageBrokenLinks.length,
      brokenLinksList: pageBrokenLinks
    });
  }

  results.summary.brokenLinks = results.brokenLinks.length;
  results.summary.warnings = results.warnings.length;
  results.summary.linksChecked = checked + results.summary.linksSkipped;
  results.summary.workingLinks = results.summary.totalLinks - results.brokenLinks.length - results.redirects.length - results.warnings.length;
  results.summary.redirects = results.redirects.length;

  return results;
}

/**
 * Check if a redirect is trivial (www vs non-www, http vs https)
 */
function isTrivialRedirect(originalUrl, finalUrl) {
  try {
    const orig = new URL(originalUrl);
    const final = new URL(finalUrl);

    // Normalize for comparison
    const origHost = orig.hostname.replace(/^www\./, '');
    const finalHost = final.hostname.replace(/^www\./, '');

    // Same domain, same path = trivial (just www or protocol change)
    if (origHost === finalHost && orig.pathname === final.pathname) {
      return true;
    }

    // Trailing slash difference
    const origPath = orig.pathname.replace(/\/$/, '');
    const finalPath = final.pathname.replace(/\/$/, '');
    if (origHost === finalHost && origPath === finalPath) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a single URL is accessible (HEAD only, fast!)
 */
async function checkUrl(url) {
  try {
    const response = await axios.head(url, {
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: null, // Don't throw on any status
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      headers: {
        'User-Agent': 'DeadLinksMustDie/3.0 (Turbo Scanner)'
      }
    });

    const redirected = response.request.res?.responseUrl && response.request.res.responseUrl !== url;

    if (response.status >= 200 && response.status < 400) {
      return {
        ok: true,
        status: response.status,
        redirected,
        finalUrl: response.request.res?.responseUrl || url
      };
    } else {
      return {
        ok: false,
        status: response.status,
        message: getStatusMessage(response.status)
      };
    }
  } catch (error) {
    // No GET fallback - fail fast!
    return {
      ok: false,
      status: 0,
      message: error.code || error.message || 'Request failed'
    };
  }
}

function getStatusMessage(status) {
  const messages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    410: 'Gone',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };

  return messages[status] || `HTTP ${status}`;
}

/**
 * Streaming link checker - checks links from a single page immediately
 * Used for pipeline architecture
 */
async function checkPageLinks(page, crawledPages, onBrokenLinkFound) {
  const linksToCheck = page.links.filter(link => !crawledPages.has(link.url));

  // Process in batches
  for (let i = 0; i < linksToCheck.length; i += CONCURRENCY) {
    const batch = linksToCheck.slice(i, i + CONCURRENCY);

    const checkPromises = batch.map(async (link) => {
      const checkResult = await checkUrl(link.url);

      if (!checkResult.ok && onBrokenLinkFound) {
        onBrokenLinkFound({
          url: link.url,
          status: checkResult.status,
          message: checkResult.message,
          occurrences: [{
            page: page.url,
            text: link.text,
            type: link.type
          }]
        });
      }

      return checkResult;
    });

    await Promise.all(checkPromises);
  }
}

module.exports = { checkLinks, checkPageLinks };
