const express = require('express');
const path = require('path');
const { crawlWebsite } = require('./crawler');
const { checkLinks, checkPageLinks } = require('./checker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Store active scans
const activeScans = new Map();

// Start a new scan
app.post('/api/scan', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
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

    // TRUE PIPELINE: Check links from each page as soon as it's crawled!
    const { pages } = await crawlWebsite(
      url,
      // Progress callback
      (progress) => {
        scan.progress.pagesFound = progress.pagesFound;
        scan.progress.pagesCrawled = progress.pagesCrawled;
      },
      // Page crawled callback - THE MAGIC HAPPENS HERE!
      async (page) => {
        // Track this page as crawled
        crawledUrls.add(page.url);

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
          checkUrlInBackground(link, page, scan, crawledUrls).then((result) => {
            linksChecked++;
            scan.progress.linksChecked = linksChecked;

            if (result && !result.ok) {
              scan.progress.brokenLinks = (scan.progress.brokenLinks || 0) + 1;
            }

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

    // Wait for all background checks to finish
    while (linksChecked < checkedUrls.size) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Compile final results
    const results = await checkLinks(
      pages,
      crawledUrls,
      () => {}, // Progress already tracked
      () => {}  // Broken links already tracked
    );

    // Complete
    scan.status = 'completed';
    scan.progress.stage = 'completed';
    scan.results = results;

    console.log(`✅ TURBO scan complete! Found ${scan.liveBrokenLinks.length} broken links`);
    console.log(`⚡ Checked ${linksChecked} links across ${pages.length} pages`);

  } catch (error) {
    console.error('Scan error:', error);
    scan.status = 'error';
    scan.error = error.message;
  }
}

// Helper to check a single URL in background (for pipeline)
async function checkUrlInBackground(link, page, scan, crawledUrls) {
  const { checkLinks } = require('./checker');
  const axios = require('axios');
  const http = require('http');
  const https = require('https');

  try {
    const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 500, timeout: 5000 });
    const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 500, timeout: 5000 });

    const response = await axios.head(link.url, {
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: null,
      httpAgent,
      httpsAgent,
      headers: { 'User-Agent': 'DeadLinksMustDie/3.0 (Turbo Scanner)' }
    });

    const ok = response.status >= 200 && response.status < 400;

    if (!ok) {
      // Skip 403/401 warnings (not truly broken, just access denied)
      if (response.status !== 403 && response.status !== 401) {
        // Found broken link - stream it immediately!
        const brokenLinkData = {
          url: link.url,
          status: response.status,
          message: response.status ? `HTTP ${response.status}` : 'Request failed',
          occurrences: [{
            page: page.url,
            text: link.text,
            type: link.type
          }]
        };

        scan.liveBrokenLinks.push(brokenLinkData);
      }
    }

    return { ok, status: response.status };
  } catch (error) {
    // Broken link
    const brokenLinkData = {
      url: link.url,
      status: 0,
      message: error.code || error.message || 'Request failed',
      occurrences: [{
        page: page.url,
        text: link.text,
        type: link.type
      }]
    };

    scan.liveBrokenLinks.push(brokenLinkData);
    return { ok: false, status: 0 };
  }
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
