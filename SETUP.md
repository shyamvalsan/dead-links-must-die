# Setup Guide

## 🚀 Quick Setup (Recommended)

```bash
# Run the automated setup script
./setup.sh
```

This will:
- ✅ Check Node.js version (requires 18.x or higher)
- ✅ Install npm dependencies
- ✅ Install Playwright browsers
- ✅ Run a quick test to verify everything works

---

## 📦 Manual Setup

If you prefer to set up manually or troubleshoot issues:

### 1. Prerequisites

**Required:**
- Node.js 18.x or higher ([download](https://nodejs.org/))
- npm (comes with Node.js)

**Optional:**
- Git (for cloning the repo)

**Check your Node.js version:**
```bash
node -v  # Should show v18.x.x or higher
npm -v   # Should show 9.x.x or higher
```

### 2. Install Dependencies

```bash
# Install all npm packages
npm install
```

This installs:
- **Production dependencies:**
  - `express` - Web server
  - `axios` - HTTP client
  - `cheerio` - HTML parser
  - `http-proxy-agent` - HTTP proxy support
  - `https-proxy-agent` - HTTPS proxy support

- **Development dependencies:**
  - `@playwright/test` - Testing framework
  - `playwright` - Browser automation

### 3. Install Playwright Browsers

```bash
# Install Chromium browser for Playwright
npx playwright install chromium --with-deps
```

This downloads the Chromium browser (~160MB) needed for E2E tests.

**Note:** If you only want to run unit/integration tests, you can skip this step.

### 4. Verify Installation

```bash
# Run unit tests (fast, no browser needed)
npm run test:unit

# If that works, try integration tests
npm run test:integration

# If everything works, try full test suite
npm test
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'express'"

**Problem:** Dependencies not installed

**Solution:**
```bash
npm install
```

### Error: "Executable doesn't exist at /root/.cache/ms-playwright/chromium"

**Problem:** Playwright browsers not installed

**Solution:**
```bash
npx playwright install chromium --with-deps
```

### Error: "EACCES: permission denied"

**Problem:** npm permissions issue

**Solution (Linux/Mac):**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install

# Option 2: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Error: "node: command not found"

**Problem:** Node.js not installed

**Solution:**
- **Linux:** `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`
- **Mac:** `brew install node`
- **Windows:** Download from https://nodejs.org/

### Tests are slow or timing out

**Problem:** Network issues or rate limiting

**Solution:**
```bash
# Run only unit tests (no network calls)
npm run test:unit

# Skip E2E tests
npx playwright test --grep-invert "e2e"
```

### Error: "Cannot POST /api/scan"

**Problem:** Server not running or wrong endpoint

**Solution:**
```bash
# Make sure server is running
npm start

# Use correct endpoint
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

---

## 🔧 Environment Setup

### Optional Environment Variables

Create a `.env` file in the project root:

```bash
# Server port (default: 3000)
PORT=3000

# HTTP proxy (if needed)
https_proxy=http://proxy.example.com:8080
http_proxy=http://proxy.example.com:8080

# No proxy for localhost
no_proxy=localhost,127.0.0.1
```

**Load environment variables:**
```bash
# Linux/Mac
source .env

# Or use dotenv package
npm install dotenv
# Then add to server.js: require('dotenv').config()
```

---

## 📋 Dependency Reference

### package.json Overview

```json
{
  "dependencies": {
    "axios": "^1.6.0",              // HTTP client for link checking
    "cheerio": "^1.0.0-rc.12",      // HTML parsing
    "express": "^4.18.2",            // Web server
    "http-proxy-agent": "^7.0.2",   // HTTP proxy support
    "https-proxy-agent": "^7.0.6"   // HTTPS proxy support
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0",  // Test framework
    "playwright": "^1.57.0"          // Browser automation
  }
}
```

### Why These Dependencies?

**axios** - Sends HTTP requests to check if links are working
**cheerio** - Parses HTML to extract links and images
**express** - Runs the web server and API
**http(s)-proxy-agent** - Allows crawling through corporate proxies
**playwright** - Runs automated browser tests

---

## 🚀 What to Run After Setup

### 1. Start the Server
```bash
npm start
# Open http://localhost:3000
```

### 2. Test the API
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### 3. Run Tests
```bash
# All tests (~2 minutes)
npm test

# Just unit tests (~5 seconds)
npm run test:unit

# Just integration tests (~20 seconds)
npm run test:integration

# Just E2E tests (~2 minutes)
npm run test:e2e

# Interactive test UI
npm run test:ui
```

### 4. View Test Report
```bash
npm run test:report
```

---

## 📁 File Structure After Setup

```
dead-links-must-die/
├── node_modules/          # ✅ Installed by npm install
├── .cache/                # ✅ Created by Playwright
│   └── ms-playwright/     # Browser binaries
├── test-results/          # ✅ Created by tests
├── playwright-report/     # ✅ Created by tests
├── public/                # Frontend files
├── tests/                 # Test suites
├── package.json           # Dependencies (this tells npm what to install)
├── setup.sh              # ✅ Setup script
└── README.md             # Documentation
```

---

## 🎓 Next Steps

After successful setup:

1. **Read the docs:**
   - `QUICKSTART.md` - How to use the tool
   - `TESTING.md` - Testing strategy
   - `SAAS-PLAN.md` - SaaS architecture (if building paid version)

2. **Try a real scan:**
   ```bash
   npm start
   # Visit http://localhost:3000
   # Enter a URL like https://example.com
   ```

3. **Deploy it:**
   - See `QUICKSTART.md` for deployment options (Vercel, Railway, Docker)

4. **Contribute:**
   - Run tests before committing: `npm test`
   - Follow test-first development (see `TESTING.md`)

---

## 🆘 Still Having Issues?

1. **Check the error message carefully** - Most errors tell you exactly what's missing

2. **Verify Node.js version:**
   ```bash
   node -v  # Must be 18.x or higher
   ```

3. **Clean install:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Check GitHub Actions:**
   - See `.github/workflows/ci.yml` for the exact setup steps we use in CI

5. **Ask for help:**
   - Open an issue on GitHub
   - Include error message and `node -v` output

---

## ✅ Success Checklist

After running setup, you should be able to:

- [ ] `npm start` - Server runs without errors
- [ ] `npm run test:unit` - Unit tests pass
- [ ] `npm run test:integration` - Integration tests pass
- [ ] `curl http://localhost:3000` - Server responds
- [ ] Browser works at http://localhost:3000

If all checked, you're ready to go! 🚀
