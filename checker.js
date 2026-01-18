const axios = require('axios');
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const { URL } = require('url');

// Configuration
const CONCURRENCY_PER_DOMAIN = 3; // Max 3 concurrent requests per domain
const DOMAIN_DELAY_MS = 500; // 500ms delay between requests to same domain
const TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 2; // Retry failed requests twice
const CIRCUIT_BREAKER_THRESHOLD = 5; // After 5 failures, stop checking domain
const DNS_TIMEOUT = 5000; // 5 seconds for DNS lookup

// Connection pooling
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 25,
  timeout: TIMEOUT
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 25,
  timeout: TIMEOUT
});

/**
 * Extract domain from URL
 */
function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Check if domain exists via DNS lookup (fast pre-check)
 */
async function checkDomainDNS(domain) {
  // Skip DNS check for localhost and loopback addresses
  if (domain === 'localhost' || domain === '127.0.0.1' || domain.startsWith('127.')) {
    return { exists: true };
  }

  try {
    await dns.resolve(domain);
    return { exists: true };
  } catch (error) {
    return { exists: false, error: error.code || 'DNS_FAILED' };
  }
}

/**
 * Delay helper with random jitter
 */
function delay(ms) {
  const jitter = Math.random() * 200; // Add 0-200ms random jitter
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

/**
 * Check links for a single domain with rate limiting and circuit breaker
 */
async function checkDomainLinks(domain, links, onProgress, onBrokenLinkFound) {
  const results = {
    checked: 0,
    broken: [],
    warnings: [],
    redirects: [],
    circuitBroken: false
  };

  let consecutiveFailures = 0;

  // Process links sequentially with delays (respects rate limits)
  for (let i = 0; i < links.length; i++) {
    const [url, occurrences] = links[i];

    // Circuit breaker: if too many consecutive failures, stop
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.log(`⚠️  Circuit breaker triggered for ${domain} - skipping remaining ${links.length - i} links`);
      results.circuitBroken = true;

      // Mark remaining as unable to verify
      for (let j = i; j < links.length; j++) {
        const [remainingUrl, remainingOcc] = links[j];
        results.warnings.push({
          url: remainingUrl,
          status: 0,
          message: 'Unable to verify (domain rate limited)',
          occurrences: remainingOcc.map(o => ({
            page: o.page,
            text: o.link.text,
            type: o.link.type
          }))
        });
      }
      break;
    }

    // Check the URL
    const checkResult = await checkUrl(url);
    results.checked++;

    // Track consecutive failures for circuit breaker
    if (checkResult.status === 0 || checkResult.message?.includes('ECONNABORTED')) {
      consecutiveFailures++;
    } else {
      consecutiveFailures = 0; // Reset on success or HTTP error
    }

    // Process result
    if (!checkResult.ok) {
      if (checkResult.status === 403 || checkResult.status === 401) {
        results.warnings.push({
          url,
          status: checkResult.status,
          message: checkResult.message + ' (may be accessible to users)',
          occurrences: occurrences.map(o => ({
            page: o.page,
            text: o.link.text,
            type: o.link.type
          }))
        });
      } else {
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
        results.broken.push(brokenLinkData);

        if (onBrokenLinkFound) {
          onBrokenLinkFound(brokenLinkData);
        }
      }
    } else if (checkResult.redirected && !isTrivialRedirect(url, checkResult.finalUrl)) {
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

    // Progress callback
    if (onProgress) {
      onProgress({ checked: 1 });
    }

    // Respectful delay between requests to same domain
    if (i < links.length - 1) {
      await delay(DOMAIN_DELAY_MS);
    }
  }

  return results;
}

/**
 * Check all links and images with domain-based rate limiting
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

  // Group links by domain
  const domainGroups = new Map(); // domain -> [[url, occurrences], ...]

  for (const [url, occurrences] of filteredLinks) {
    const domain = getDomain(url);
    if (!domain) continue;

    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain).push([url, occurrences]);
  }

  console.log(`🌐 Found ${domainGroups.size} unique domains to check`);

  // DNS pre-check: quickly eliminate dead domains
  console.log(`🔍 Running DNS pre-check on ${domainGroups.size} domains...`);
  const dnsCheckPromises = Array.from(domainGroups.keys()).map(async (domain) => {
    const dnsResult = await checkDomainDNS(domain);
    return { domain, ...dnsResult };
  });

  const dnsResults = await Promise.all(dnsCheckPromises);
  const deadDomains = dnsResults.filter(r => !r.exists);

  console.log(`💀 Found ${deadDomains.length} dead domains (DNS failed)`);

  // Remove dead domains and mark their links as broken
  const deadDomainLinks = [];
  for (const { domain, error } of deadDomains) {
    const links = domainGroups.get(domain);
    for (const [url, occurrences] of links) {
      deadDomainLinks.push({
        url,
        status: 0,
        message: `DNS lookup failed: ${error}`,
        occurrences: occurrences.map(o => ({
          page: o.page,
          text: o.link.text,
          type: o.link.type
        }))
      });
    }
    domainGroups.delete(domain);
  }

  console.log(`✨ ${domainGroups.size} domains remain for HTTP checking`);

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
    brokenLinks: [...deadDomainLinks], // Start with DNS failures
    redirects: [],
    warnings: []
  };

  let checked = deadDomainLinks.length; // Count DNS failures as checked

  // Wrap progress callback to accumulate counts
  const wrappedProgress = onProgress ? (delta) => {
    checked += delta.checked || 0;
    onProgress({ checked: checked + results.summary.linksSkipped, broken: results.brokenLinks.length });
  } : null;

  // Process ALL domains in parallel (each domain respects its own rate limits internally)
  console.log(`🚀 Checking links across ${domainGroups.size} domains in parallel...`);

  const domainCheckPromises = Array.from(domainGroups.entries()).map(async ([domain, links]) => {
    console.log(`   → ${domain}: checking ${links.length} links`);
    const domainResults = await checkDomainLinks(domain, links, wrappedProgress, onBrokenLinkFound);

    console.log(`   ✓ ${domain}: ${domainResults.checked} checked, ${domainResults.broken.length} broken${domainResults.circuitBroken ? ' (circuit broken)' : ''}`);

    return domainResults;
  });

  const allDomainResults = await Promise.all(domainCheckPromises);

  // Merge all results
  for (const domainResult of allDomainResults) {
    results.brokenLinks.push(...domainResult.broken);
    results.redirects.push(...domainResult.redirects);
    results.warnings.push(...domainResult.warnings);
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
 * Check if a single URL is accessible with retry logic and HEAD->GET fallback
 */
async function checkUrl(url) {
  // Try with retries and fallback strategies
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // First try HEAD request (fast)
      const headResult = await checkUrlWithMethod(url, 'HEAD', attempt);

      // If HEAD succeeded, return result
      if (headResult.ok || headResult.status >= 400) {
        return headResult;
      }

      // If HEAD returned 404/405 (method not allowed), try GET as fallback
      if (headResult.status === 404 || headResult.status === 405 || headResult.status === 0) {
        console.log(`  ↻ HEAD failed for ${url}, trying GET...`);
        const getResult = await checkUrlWithMethod(url, 'GET', 0); // No retries for GET
        if (getResult.ok) {
          return getResult;
        }
      }

      // Return HEAD result if not retrying
      if (attempt === MAX_RETRIES) {
        return headResult;
      }

      // Wait before retry (exponential backoff)
      if (headResult.status === 0) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return headResult; // Don't retry non-network errors
      }

    } catch (error) {
      // Hard timeout or unexpected error
      if (attempt === MAX_RETRIES) {
        return {
          ok: false,
          status: 0,
          message: error.code || error.message || 'Request failed'
        };
      }

      // Wait before retry
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Fallback (should never reach here)
  return {
    ok: false,
    status: 0,
    message: 'Request failed after retries'
  };
}

/**
 * Check URL with specific HTTP method
 */
async function checkUrlWithMethod(url, method, attempt) {
  try {
    const options = {
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: null, // Don't throw on any status
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)'
      }
    };

    // For GET, limit response size to avoid downloading huge files
    if (method === 'GET') {
      options.maxContentLength = 1024 * 1024; // 1MB max
      options.responseType = 'stream'; // Stream to avoid loading entire file
    }

    const response = method === 'HEAD'
      ? await axios.head(url, options)
      : await axios.get(url, options);

    // If GET with stream, immediately destroy to stop download
    if (method === 'GET' && response.data && response.data.destroy) {
      response.data.destroy();
    }

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
    // Network errors, timeouts, etc.
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
