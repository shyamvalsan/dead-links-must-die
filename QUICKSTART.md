# Quick Start Guide

## 🚀 Getting Started

### 1. Installation

```bash
git clone https://github.com/shyamvalsan/dead-links-must-die.git
cd dead-links-must-die
npm install
```

### 2. Start the Server

```bash
npm start
```

Server runs on http://localhost:3000

### 3. Test It Out

Open your browser to http://localhost:3000

Or use the API directly:

```bash
# Start a scan
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Response: {"scanId":"1234567890"}

# Check progress
curl http://localhost:3000/api/scan/1234567890/progress

# Get final results
curl http://localhost:3000/api/scan/1234567890
```

## 📊 Example Usage

### Simple Site (Fast)
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### Large Site (Slow, 1000+ pages)
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.netdata.cloud"}'
```

### JavaScript SPA (Automatic Sitemap Fallback)
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://learn.netdata.cloud"}'
```

## 🧪 Testing

```bash
# Run all tests (48 tests)
npm test

# Run specific test suites
npm run test:unit          # Fast unit tests (~10s)
npm run test:integration   # Integration tests (~20s)
npm run test:e2e           # Real-world E2E tests (~2min)

# Interactive UI
npm run test:ui

# HTML report
npm test && npm run test:report
```

## 🏗️ Architecture

```
User → Frontend (public/) → API (server.js) → Smart Crawler
                                             ↓
                                    Traditional OR Sitemap
                                             ↓
                                        Link Checker
                                             ↓
                                      Results + Report
```

### Key Components

- **server.js** - Express API server
- **smart-crawler.js** - Auto-detects traditional vs SPA
- **crawler.js** - Traditional HTML crawling
- **sitemap-crawler.js** - SPA sitemap parsing
- **checker.js** - Link validation logic

## 📖 API Documentation

### POST /api/scan

Start a new scan.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "scanId": "1234567890"
}
```

### GET /api/scan/:scanId/progress

Get real-time progress.

**Response:**
```json
{
  "stage": "crawling",
  "pagesFound": 10,
  "pagesCrawled": 5,
  "linksChecked": 20,
  "totalLinks": 50,
  "brokenLinks": 2,
  "eta": 30000
}
```

### GET /api/scan/:scanId

Get final results.

**Response:**
```json
{
  "url": "https://example.com",
  "status": "completed",
  "results": {
    "summary": {
      "totalPages": 10,
      "totalLinks": 50,
      "brokenLinks": 2,
      "warnings": 1,
      "redirects": 3
    },
    "brokenLinks": [
      {
        "url": "https://example.com/broken",
        "status": 404,
        "message": "Not Found",
        "occurrences": [
          {
            "page": "https://example.com/",
            "text": "Click here",
            "type": "link"
          }
        ]
      }
    ]
  }
}
```

## 🎯 What Gets Checked

### Links
- ✅ Internal links (same domain)
- ✅ External links (other domains)
- ✅ Hash fragments (#section)
- ✅ Query parameters (?param=value)
- ✅ Redirects (HTTP 301/302)

### Images
- ✅ All `<img src="...">` tags
- ✅ Broken images (404/500)
- ✅ Missing images

### Status Codes
- **200-399**: ✅ Working
- **401/403**: ⚠️ Warning (may work for users)
- **404**: ❌ Broken (Not Found)
- **500-599**: ❌ Broken (Server Error)
- **DNS Failure**: ❌ Broken (Domain doesn't exist)
- **Timeout**: ❌ Broken (Too slow)

## 🔍 How It Works

### 1. Site Detection
```
Is it a SPA?
├─ No → Use traditional crawler
└─ Yes → Use sitemap.xml fallback
```

Detection logic:
- If 1 page found with 0 links → Likely SPA
- Try sitemap.xml as fallback
- If sitemap exists → Fetch all pages from sitemap

### 2. Link Checking
- Skip internal pages (already crawled)
- Check external links via HTTP HEAD/GET
- DNS pre-check to eliminate dead domains quickly
- Rate limit: 3 concurrent per domain, 500ms delay
- Retry failed links (up to 2 retries)
- Circuit breaker (stop after 5 consecutive failures per domain)

### 3. Results Organization
- Per-page breakdown (which pages have broken links)
- Occurrence tracking (where each broken link appears)
- Categorization (broken, warnings, redirects)
- Summary statistics

## 🚦 Environment Variables

```bash
# Optional: Use HTTP proxy
export https_proxy=http://proxy.example.com:8080

# Optional: Bypass proxy for localhost
export no_proxy=localhost,127.0.0.1

# Optional: Custom port
export PORT=8080
```

## 📝 Common Issues

### "Only found 1 page" on normal site
- Site may block crawlers (check robots.txt)
- Links may be JS-rendered (we'll fall back to sitemap)
- Site may have aggressive bot detection

### SPA not detected
- Verify sitemap.xml exists at /sitemap.xml
- Check console logs for detection messages
- Site must have truly 0 links in initial HTML

### Tests failing
- E2E tests may be rate-limited by external sites
- Run unit/integration tests more frequently
- E2E tests are slower, run less often

## 🎓 Learn More

- **CLAUDE.md** - Development guide and philosophy
- **TESTING.md** - Comprehensive testing strategy
- **README.md** - User-facing documentation

## 🚀 Deploying to Production

See deployment guide in README.md for:
- Vercel deployment (free tier)
- Railway deployment (backend)
- Docker deployment
- Environment setup

---

**Need help?** Check the [full documentation](README.md) or [open an issue](https://github.com/shyamvalsan/dead-links-must-die/issues).
