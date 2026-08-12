# Dead Links Must Die - Usage Guide

## Quick Start

### Option 1: Smart Crawler (Recommended) 🧠

**Automatically handles both traditional sites and SPAs:**

```javascript
const { smartCrawl } = require('./smart-crawler');

// Works for ANY site - automatically detects and adapts
const result = await smartCrawl(
  'https://example.com',
  (progress) => {
    console.log(`${progress.pagesCrawled}/${progress.pagesFound} pages`);
  },
  (page) => {
    console.log(`Crawled: ${page.url}`);
  }
);

console.log(`Found ${result.pages.length} pages using ${result.method} method`);
```

**What it does:**
1. ✅ Tries traditional HTML crawling first
2. ✅ Detects SPAs automatically (1 page + 0 links = SPA)
3. ✅ Falls back to sitemap.xml for SPAs
4. ✅ Returns best available results

---

### Option 2: Manual Selection

**For traditional HTML sites:**

```javascript
const { crawlWebsite } = require('./crawler');

const result = await crawlWebsite('https://www.netdata.cloud');
// Result: 2,302 pages in ~75 seconds
```

**For JavaScript SPAs (Docusaurus, React, etc.):**

```javascript
const { discoverFromSitemap } = require('./sitemap-crawler');

const pages = await discoverFromSitemap('https://learn.netdata.cloud');
// Result: 808 pages in 0.18 seconds
```

---

## Examples

### Example 1: Basic Link Checking

```javascript
const { smartCrawl } = require('./smart-crawler');
const { checkLinks } = require('./checker');

async function checkSite(url) {
  // Discover all pages
  const { pages } = await smartCrawl(url);

  // Check all links
  const results = await checkLinks(pages);

  console.log(`Broken links: ${results.brokenLinks.length}`);
}

checkSite('https://www.netdata.cloud');
```

### Example 2: With Progress Tracking

```javascript
const { smartCrawl } = require('./smart-crawler');

async function crawlWithProgress(url) {
  const result = await smartCrawl(
    url,
    // Progress callback
    (progress) => {
      console.log(`📊 ${progress.pagesCrawled}/${progress.pagesFound} pages crawled`);
    },
    // Page callback
    (page) => {
      if (!page.error) {
        console.log(`✅ ${page.url} - ${page.linksCount} links`);
      }
    }
  );

  console.log(`\n✅ Complete! Method: ${result.method}, Pages: ${result.pages.length}`);
  return result;
}
```

### Example 3: Check if Site is SPA

```javascript
const { isSPA, crawlWebsite } = require('./smart-crawler');

async function detectSPA(url) {
  const result = await crawlWebsite(url);

  if (isSPA(result)) {
    console.log('🔍 This is a JavaScript SPA');
  } else {
    console.log('📄 This is a traditional HTML site');
  }
}
```

---

## Test Commands

```bash
# Test traditional crawling (local mock site)
node dev-tests/test-local-crawler.js

# Test sitemap crawling (learn.netdata.cloud)
node dev-tests/test-sitemap-crawler.js

# Test smart crawler (both www and learn.netdata.cloud)
node dev-tests/test-smart-crawler.js

# Test with netdata.cloud sites
node dev-tests/test-netdata-working.js
```

---

## Performance Comparison

| Site Type | Method | Pages | Time | Tool |
|-----------|--------|-------|------|------|
| **Traditional** | HTML crawling | 2,302 | 75s | `crawlWebsite()` |
| **SPA** | Sitemap | 808 | 0.18s | `discoverFromSitemap()` |
| **Auto** | Smart detection | Both | Best | `smartCrawl()` ✅ |

---

## When to Use What

### Use `smartCrawl()` when:
- ✅ You don't know if site is traditional or SPA
- ✅ You want automatic detection and fallback
- ✅ You want the best possible coverage
- ✅ **This is the recommended default**

### Use `crawlWebsite()` when:
- You know it's a traditional HTML site
- You want fine-grained control
- You're implementing custom crawling logic

### Use `discoverFromSitemap()` when:
- You know it's a SPA with sitemap
- You want maximum speed for documentation sites
- You only need the URL list (not link checking)

---

## API Reference

### `smartCrawl(url, onProgress, onPageCrawled)`

Returns:
```javascript
{
  pages: [...],           // Array of page objects
  crawledUrls: Set,       // Set of URLs visited
  method: 'traditional',  // or 'sitemap'
  isSPA: false            // true if SPA detected
}
```

### `crawlWebsite(url, onProgress, onPageCrawled)`

Traditional HTML crawler. Returns same format as `smartCrawl()`.

### `discoverFromSitemap(url)`

Sitemap-based discovery. Returns array of page objects.

### `isSPA(crawlResult)`

Detects if a crawl result indicates a SPA (1 page, 0 links).

---

## Architecture

```
┌─────────────────┐
│  smartCrawl()   │ ← Recommended entry point
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐  ┌──────────────┐
│ crawler │  │ sitemap-     │
│.js      │  │ crawler.js   │
└─────────┘  └──────────────┘
Traditional   SPA fallback
 (95%)           (5%)
```

---

## Configuration

The crawler respects these environment variables:

- `https_proxy` / `HTTPS_PROXY` - Proxy URL
- `http_proxy` / `HTTP_PROXY` - HTTP proxy URL
- `no_proxy` / `NO_PROXY` - Comma-separated list of hosts to bypass proxy

Example:
```bash
export https_proxy=http://proxy.example.com:8080
export no_proxy=localhost,127.0.0.1
node dev-tests/test-smart-crawler.js
```

---

## Troubleshooting

### "Only found 1 page" on a traditional site

- Check robots.txt - site may block crawlers
- Check for 403 errors - bot protection enabled
- Links may be JavaScript-generated (use sitemap fallback)

### "No sitemap found" on a SPA

- Check if sitemap.xml exists: `curl https://site.com/sitemap.xml`
- Some SPAs don't generate sitemaps
- Consider using Puppeteer for these rare cases

### Slow crawling

- Reduce `CRAWL_CONCURRENCY` in crawler.js (default: 20)
- Increase `CRAWL_TIMEOUT` if pages are timing out
- Check your network connection

---

## Production Deployment

For production use, integrate with your server:

```javascript
const express = require('express');
const { smartCrawl } = require('./smart-crawler');

app.post('/api/scan', async (req, res) => {
  const { url } = req.body;

  try {
    const result = await smartCrawl(url);
    res.json({
      success: true,
      pages: result.pages.length,
      method: result.method
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

See `server.js` for full implementation.
