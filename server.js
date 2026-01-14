const express = require('express');
const path = require('path');
const { crawlWebsite } = require('./crawler');
const { checkLinks } = require('./checker');

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
      eta: null
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

// Perform the actual scanning with PIPELINE ARCHITECTURE
async function performScan(scanId, url) {
  const scan = activeScans.get(scanId);

  try {
    // Start crawling
    scan.status = 'scanning';
    scan.progress.stage = 'scanning';

    console.log(`🚀 Starting scan for ${url}`);

    // Crawl website with parallel processing
    const { pages, crawledUrls } = await crawlWebsite(
      url,
      // Progress callback
      (progress) => {
        scan.progress.pagesFound = progress.pagesFound;
        scan.progress.pagesCrawled = progress.pagesCrawled;
      },
      // Page crawled callback (for pipeline - not used yet, but available)
      null
    );

    console.log(`✅ Crawling complete: ${pages.length} pages`);

    // Now check all links with the crawled URLs to skip internal links
    scan.progress.stage = 'checking_links';

    // Calculate total links
    scan.progress.totalLinks = pages.reduce((sum, page) => sum + page.links.length, 0);

    console.log(`🔍 Starting link check: ${scan.progress.totalLinks} total links`);

    const results = await checkLinks(
      pages,
      crawledUrls, // Pass crawled URLs so checker can skip them
      // Progress callback
      (progress) => {
        scan.progress.linksChecked = progress.checked;
        scan.progress.brokenLinks = progress.broken;

        // Calculate ETA
        const elapsed = Date.now() - scan.progress.startTime;
        const rate = progress.checked / elapsed;
        const remaining = scan.progress.totalLinks - progress.checked;
        scan.progress.eta = remaining > 0 ? Math.round(remaining / rate) : 0;
      },
      // Broken link found callback - REAL-TIME STREAMING!
      (brokenLink) => {
        scan.liveBrokenLinks.push(brokenLink);
      }
    );

    // Complete
    scan.status = 'completed';
    scan.progress.stage = 'completed';
    scan.results = results;

    console.log(`✅ Scan complete! Found ${results.brokenLinks.length} broken links`);

  } catch (error) {
    console.error('Scan error:', error);
    scan.status = 'error';
    scan.error = error.message;
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
