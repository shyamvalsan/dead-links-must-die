const express = require('express');
const path = require('path');
const { smartCrawl } = require('./smart-crawler');
const { checkLinks, checkPageLinks } = require('./checker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Store active scans
const activeScans = new Map();

// Start a new scan
app.post('/api/scan', async (req, res) => {
  let { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Auto-add https:// if no protocol specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const scanId = Date.now().toString();

  // Initialize scan data
  activeScans.set(scanId, {
    url,
    status: 'starting',
    progress: {
      stage: 'initializing',
      pagesFound: 0,
      pagesCrawled: 0,
      linksChecked: 0,
      totalLinks: 0,
      brokenLinks: 0,
      startTime: Date.now(),
      eta: null,
      elapsedTime: 0
    },
    errorBreakdown: {
      '404': 0,
      '500': 0,
      '403': 0,
      '401': 0,
      'ETIMEDOUT': 0,
      'ECONNABORTED': 0,
      'ECONNREFUSED': 0,
      'DNS_FAILED': 0,
      'OTHER': 0
    },
    results: null,
    liveBrokenLinks: [] // Real-time broken links as they're found
  });

  res.json({ scanId });

  // Start scanning in background
  performScan(scanId, url);
});

// Server-Sent Events endpoint for progress updates
app.get('/api/scan/:scanId/progress', (req, res) => {
  const { scanId } = req.params;

  if (!activeScans.has(scanId)) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial data
  const scan = activeScans.get(scanId);
  res.write(`data: ${JSON.stringify(scan)}\n\n`);

  // Send updates every 500ms
  const intervalId = setInterval(() => {
    const scan = activeScans.get(scanId);
    if (!scan) {
      clearInterval(intervalId);
      res.end();
      return;
    }

    // Calculate elapsed time
    scan.progress.elapsedTime = Date.now() - scan.progress.startTime;

    res.write(`data: ${JSON.stringify(scan)}\n\n`);

    // Close connection when scan is complete
    if (scan.status === 'completed' || scan.status === 'error') {
      clearInterval(intervalId);
      setTimeout(() => res.end(), 1000);
    }
  }, 500);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Get scan results
app.get('/api/scan/:scanId', (req, res) => {
  const { scanId } = req.params;
  const scan = activeScans.get(scanId);

  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  res.json(scan);
});

// Perform the actual scanning with TRUE PIPELINE ARCHITECTURE
// Check links as pages are crawled for maximum speed!
async function performScan(scanId, url) {
  const scan = activeScans.get(scanId);

  try {
    // Start scanning
    scan.status = 'scanning';
    scan.progress.stage = 'scanning';

    console.log(`🚀 Starting TURBO scan for ${url}`);

    let linksChecked = 0;
    let totalLinksFound = 0;
    const checkedUrls = new Set();
    const crawledUrls = new Set(); // Create this BEFORE crawlWebsite to avoid reference error
    const allBrokenLinks = [];

    // Activity tracker: Auto-complete if 30s pass with no activity
    let lastActivityTime = Date.now();
    let lastPagesCrawled = 0;
    let lastLinksChecked = 0;
    let shouldForceComplete = false; // Flag to force completion on timeout

    // Monitor for inactivity and auto-complete if stuck
    const activityMonitor = setInterval(() => {
      const currentPagesCrawled = scan.progress.pagesCrawled || 0;
      const currentLinksChecked = linksChecked;

      // Check if we made progress
      if (currentPagesCrawled > lastPagesCrawled || currentLinksChecked > lastLinksChecked) {
        // Activity detected, reset timer
        lastActivityTime = Date.now();
        lastPagesCrawled = currentPagesCrawled;
        lastLinksChecked = currentLinksChecked;
      } else {
        // No activity - check if 30s elapsed
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > 30000) {
          console.log(`⚠️  No activity for 30s - auto-completing scan`);
          console.log(`   Pages: ${currentPagesCrawled}, Links: ${currentLinksChecked}`);
          shouldForceComplete = true; // Trigger forced completion
          clearInterval(activityMonitor);
        }
      }
    }, 1000); // Check every second

    // TRUE PIPELINE: Check links from each page as soon as it's crawled!
    // Using smartCrawl for automatic SPA detection and sitemap fallback
    const { pages } = await smartCrawl(
      url,
      // Progress callback
      (progress) => {
        scan.progress.pagesFound = progress.pagesFound;
        scan.progress.pagesCrawled = progress.pagesCrawled;
        lastActivityTime = Date.now(); // Update activity time
      },
      // Page crawled callback - THE MAGIC HAPPENS HERE!
      async (page) => {
        // Track this page as crawled
        crawledUrls.add(page.url);
        lastActivityTime = Date.now(); // Update activity time

        // Immediately check links from this page (don't wait for all crawling!)
        const linksToCheck = page.links.filter(link => {
          if (checkedUrls.has(link.url)) return false;
          checkedUrls.add(link.url);
          return !crawledUrls.has(link.url); // Skip internal pages we crawled
        });

        totalLinksFound += page.links.length;
        scan.progress.totalLinks = totalLinksFound;

        // Check this page's links in parallel with crawling other pages
        for (const link of linksToCheck) {
          // Fire and forget - check in background
          // IMPORTANT: Use .finally() to ensure counter always increments, even on errors
          checkUrlInBackground(link, page, scan, crawledUrls)
            .then((result) => {
              if (result && !result.ok) {
                scan.progress.brokenLinks = (scan.progress.brokenLinks || 0) + 1;
              }
            })
            .catch((error) => {
              // Log but don't crash - some links will fail
              console.error(`Error checking ${link.url}:`, error.message);
            })
            .finally(() => {
              // ALWAYS increment counter, even if check failed/timed out
              linksChecked++;
              scan.progress.linksChecked = linksChecked;
              lastActivityTime = Date.now(); // Update activity time

              // Calculate ETA
              const elapsed = Date.now() - scan.progress.startTime;
              const rate = linksChecked / elapsed;
              const remaining = Math.max(0, totalLinksFound - linksChecked);
              scan.progress.eta = remaining > 0 ? Math.round(remaining / rate) : 0;
            });
        }
      }
    );

    console.log(`✅ Crawling complete: ${pages.length} pages`);
    console.log(`🔍 Waiting for remaining link checks to complete...`);
    console.log(`   Expected: ${checkedUrls.size} checks, Completed: ${linksChecked}`);

    // Wait for all background checks to finish with timeout protection
    let lastProgress = linksChecked;
    let noProgressCount = 0;
    const MAX_NO_PROGRESS_CYCLES = 30; // 30 seconds without progress = give up

    while (linksChecked < checkedUrls.size && !shouldForceComplete) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if forced to complete by activity monitor
      if (shouldForceComplete) {
        console.log(`⚠️  Activity monitor triggered force completion`);
        break;
      }

      // Check if we made progress
      if (linksChecked > lastProgress) {
        lastProgress = linksChecked;
        noProgressCount = 0;
        console.log(`   Progress: ${linksChecked}/${checkedUrls.size} checks complete`);
      } else {
        noProgressCount++;

        // If no progress for 30 seconds, give up waiting
        if (noProgressCount >= MAX_NO_PROGRESS_CYCLES) {
          console.log(`⚠️  No progress for ${MAX_NO_PROGRESS_CYCLES}s, completing scan with ${linksChecked}/${checkedUrls.size} checks`);
          break;
        }
      }
    }

    // Clean up activity monitor
    clearInterval(activityMonitor);

    console.log(`✅ All link checks complete!`);
    console.log(`⚡ Checked ${linksChecked} links across ${pages.length} pages`);

    // Compile final results from what we already checked (no need to re-check!)
    const results = {
      summary: {
        totalPages: pages.length,
        totalLinks: totalLinksFound,
        linksChecked: linksChecked,
        linksSkipped: totalLinksFound - checkedUrls.size,
        brokenLinks: scan.liveBrokenLinks.length,
        workingLinks: linksChecked - scan.liveBrokenLinks.length,
        redirects: 0, // TODO: track redirects in pipeline
        warnings: 0   // TODO: track 403/401 in pipeline
      },
      pages: pages.map(page => ({
        url: page.url,
        title: page.title,
        totalLinks: page.links.length,
        brokenLinks: scan.liveBrokenLinks.filter(bl =>
          bl.occurrences.some(occ => occ.page === page.url)
        ).length,
        brokenLinksList: scan.liveBrokenLinks.filter(bl =>
          bl.occurrences.some(occ => occ.page === page.url)
        )
      })),
      brokenLinks: scan.liveBrokenLinks,
      redirects: [], // TODO: implement in pipeline
      warnings: []   // TODO: implement in pipeline
    };

    // Complete
    scan.status = 'completed';
    scan.progress.stage = 'completed';
    scan.results = results;

    console.log(`✅ TURBO scan complete! Found ${scan.liveBrokenLinks.length} broken links`);

  } catch (error) {
    console.error('Scan error:', error);
    scan.status = 'error';
    scan.error = error.message;

    // Clean up activity monitor on error
    if (typeof activityMonitor !== 'undefined') {
      clearInterval(activityMonitor);
    }
  }
}

// Helper to categorize and track error types
function trackError(scan, status, message) {
  let errorType = 'OTHER';

  if (status === 404) errorType = '404';
  else if (status === 500 || status === 502 || status === 503 || status === 504) errorType = '500';
  else if (status === 403) errorType = '403';
  else if (status === 401) errorType = '401';
  else if (message && message.includes('ETIMEDOUT')) errorType = 'ETIMEDOUT';
  else if (message && message.includes('ECONNABORTED')) errorType = 'ECONNABORTED';
  else if (message && message.includes('ECONNREFUSED')) errorType = 'ECONNREFUSED';
  else if (message && message.includes('DNS')) errorType = 'DNS_FAILED';

  if (scan.errorBreakdown[errorType] !== undefined) {
    scan.errorBreakdown[errorType]++;
  } else {
    scan.errorBreakdown['OTHER']++;
  }
}

// Helper to check a single URL in background (for pipeline) with retry + fallback
async function checkUrlInBackground(link, page, scan, crawledUrls) {
  const axios = require('axios');
  const http = require('http');
  const https = require('https');
  const { HttpsProxyAgent } = require('https-proxy-agent');

  const TIMEOUT = 10000; // 10 seconds
  const MAX_RETRIES = 2;

  // Use proxy if configured in environment
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 200, timeout: TIMEOUT });
  const httpsAgent = proxyUrl
    ? new HttpsProxyAgent(proxyUrl)
    : new https.Agent({ keepAlive: true, maxSockets: 200, timeout: TIMEOUT });

  // Try with retry and HEAD->GET fallback
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Try HEAD first
      const response = await axios.head(link.url, {
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: null,
        httpAgent,
        httpsAgent,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)' }
      });

      const ok = response.status >= 200 && response.status < 400;

      // If HEAD returned 404/405, try GET as fallback
      if (!ok && (response.status === 404 || response.status === 405)) {
        try {
          const getResponse = await axios.get(link.url, {
            timeout: TIMEOUT,
            maxRedirects: 5,
            validateStatus: null,
            httpAgent,
            httpsAgent,
            maxContentLength: 1024 * 1024, // 1MB max
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)' }
          });

          // Destroy stream immediately
          if (getResponse.data && getResponse.data.destroy) {
            getResponse.data.destroy();
          }

          const getOk = getResponse.status >= 200 && getResponse.status < 400;

          if (getOk) {
            return { ok: true, status: getResponse.status };
          }

          // GET also failed, use GET result
          if (getResponse.status !== 403 && getResponse.status !== 401) {
            const message = `HTTP ${getResponse.status}`;
            trackError(scan, getResponse.status, message);
            scan.liveBrokenLinks.push({
              url: link.url,
              status: getResponse.status,
              message,
              occurrences: [{ page: page.url, text: link.text, type: link.type }]
            });
          }
          return { ok: false, status: getResponse.status };

        } catch (getError) {
          // GET failed too, continue to retry logic below
        }
      }

      // Process HEAD result
      if (!ok && response.status !== 403 && response.status !== 401) {
        const message = `HTTP ${response.status}`;
        trackError(scan, response.status, message);
        scan.liveBrokenLinks.push({
          url: link.url,
          status: response.status,
          message,
          occurrences: [{ page: page.url, text: link.text, type: link.type }]
        });
      }

      return { ok, status: response.status };

    } catch (error) {
      // Network error or timeout
      if (attempt < MAX_RETRIES) {
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Final attempt failed
      const message = error.code || error.message || 'Request failed';
      trackError(scan, 0, message);
      scan.liveBrokenLinks.push({
        url: link.url,
        status: 0,
        message,
        occurrences: [{ page: page.url, text: link.text, type: link.type }]
      });
      return { ok: false, status: 0 };
    }
  }

  // Should never reach here
  return { ok: false, status: 0 };
}

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`🔗 Dead Links Must Die!`);
    console.log(`Server running on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ Port ${port} is already in use`);
      const nextPort = port + 1;
      if (nextPort <= port + 10) {
        console.log(`🔄 Trying port ${nextPort}...`);
        startServer(nextPort);
      } else {
        console.error('❌ Could not find an available port. Please specify a PORT environment variable.');
        process.exit(1);
      }
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
