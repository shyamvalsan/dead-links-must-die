# Dead Links Must Die - Development Guide

## Project Vision

**A dead-simple, blazingly fast broken link checker that just works.**

- Check any website for broken links
- Automatically handles traditional sites AND JavaScript SPAs
- Free and open source core
- SaaS for scheduled monitoring (future)

## Core Philosophy

### 1. **Simplicity Over Cleverness**
- Readable code > Smart code
- If optimization makes code 10% harder to read for 2% speed gain → **don't do it**
- Future you (and contributors) will thank you

### 2. **Test-First Development**
- Write tests BEFORE features
- Real-world tests with actual sites (not just mocks)
- Playwright for end-to-end user flows
- Tests run on every commit via GitHub Actions

### 3. **Ship Fast, Iterate**
- MVP beats perfect
- Get feedback from real users
- Build what people actually need, not what we think they need

### 4. **Open Source Core, SaaS Convenience**
- Core crawler: 100% open source
- Anyone can self-host for free
- SaaS adds convenience (scheduling, notifications, history)
- Win-win: OSS credibility + revenue potential

## Architecture

```
User Input (URL)
       ↓
smart-crawler.js ← Main entry point
       ↓
┌──────┴──────┐
│             │
↓             ↓
crawler.js    sitemap-crawler.js
(Traditional) (SPAs)
       ↓
   Results
```

### How It Works

1. **User enters URL** → `smartCrawl(url)`
2. **Try traditional HTML crawling** → Works for 95% of sites
3. **Detect SPA?** (1 page + 0 links) → Auto-fallback to sitemap
4. **Return results** → Pages found + broken links

### Key Files

```
crawler.js           - Traditional HTML crawler (native https, no axios)
sitemap-crawler.js   - Sitemap.xml parser for SPAs
smart-crawler.js     - Auto-detection + fallback logic
server.js            - Express server (uses smartCrawl)
checker.js           - Link validation logic
```

## Development Workflow

### Before You Code

1. **Write the test first**
   ```javascript
   // tests/feature.spec.js
   test('should do X', async () => {
     const result = await doX();
     expect(result).toBe(expected);
   });
   ```

2. **Run test (it should fail)**
   ```bash
   npm test
   ```

3. **Write minimal code to pass**

4. **Refactor if needed** (keeping tests green)

### Testing Strategy

**Unit Tests** (`tests/unit/`)
- Test individual functions
- Fast, isolated
- No network calls

**Integration Tests** (`tests/integration/`)
- Test components together
- Use local mock servers
- Verify interactions

**E2E Tests** (`tests/e2e/`)
- Test real user flows
- Use Playwright
- Test against real websites
- Run less frequently (slow)

### Real-World Test Sites

We test against actual production sites to catch real issues:

```javascript
// Good variety of site types
const testSites = [
  'https://www.netdata.cloud',      // Traditional, 2000+ pages
  'https://learn.netdata.cloud',    // Docusaurus SPA, 800+ pages
  'https://example.com',            // Simple HTML
  'http://httpbin.org',             // HTTP testing
  // Add more as needed
];
```

## Code Style

### Keep It Simple

**✅ Good (readable):**
```javascript
function isInternalLink(url, baseUrl) {
  try {
    const linkHost = new URL(url).hostname;
    const baseHost = new URL(baseUrl).hostname;
    return linkHost === baseHost;
  } catch (error) {
    return false;
  }
}
```

**❌ Bad (clever but confusing):**
```javascript
const isInt = (u, b) => {
  try { return new URL(u).hostname === new URL(b).hostname; }
  catch { return false; }
};
```

### Error Handling

**Be explicit:**
```javascript
// Good
try {
  const result = await crawlSite(url);
  return result;
} catch (error) {
  console.error(`Failed to crawl ${url}:`, error.message);
  return { error: error.message };
}

// Bad (silent failure)
try {
  return await crawlSite(url);
} catch {
  return null;
}
```

### Comments

**Comment the WHY, not the WHAT:**

```javascript
// Good
// Check normalized URL to avoid duplicate crawls of example.com/ and example.com
if (visited.has(normalizeUrl(url))) return;

// Bad
// Check if URL is in visited set
if (visited.has(url)) return;
```

## Git Workflow

### Commits

**Format:**
```
<type>: <short description>

<detailed explanation if needed>

<why this change was made>
```

**Types:**
- `fix:` Bug fixes
- `feat:` New features
- `test:` Add/update tests
- `refactor:` Code improvements (no behavior change)
- `docs:` Documentation
- `chore:` Tooling, deps, etc.

**Example:**
```
fix: sitemap crawler now fetches pages to check links

Problem: Sitemap discovery only returned URLs, not page content.
This meant we couldn't check links on SPA pages.

Solution: Fetch each sitemap URL and extract links before returning.
Result: learn.netdata.cloud now checks 808 pages with links.
```

### Branches

- `main` - Always deployable
- Feature work - Direct commits OK (solo project)
- Breaking changes - Test thoroughly first

## Testing Philosophy

### Test Pyramid

```
     /\      E2E (Playwright)
    /  \     - Slow, realistic
   /____\    - Test critical user flows
  /      \   Integration
 /        \  - Medium speed
/__________\ Unit
             - Fast, many tests
```

### What to Test

**Must Test:**
- ✅ Core crawler logic
- ✅ SPA detection and fallback
- ✅ Link extraction
- ✅ Real-world sites (at least 3)
- ✅ Error handling

**Don't Test:**
- ❌ Third-party libraries (trust them)
- ❌ Trivial getters/setters
- ❌ Private implementation details

### When Tests Fail

1. **Don't immediately change the test**
2. **Understand why it failed** (real bug? flaky? site changed?)
3. **Fix the bug or update test** (if site changed)
4. **Never commit failing tests**

## Deployment

### Current: Local Development
```bash
npm install
npm start
# Visit http://localhost:3000
```

### Future: Vercel (Free)
```bash
vercel --prod
```

### Environment Variables
```bash
# Optional: Use proxy
export https_proxy=http://proxy.example.com:8080

# Optional: Bypass proxy for localhost
export no_proxy=localhost,127.0.0.1
```

## Project Structure

```
dead-links-must-die/
├── crawler.js              # Traditional HTML crawler
├── sitemap-crawler.js      # SPA sitemap crawler
├── smart-crawler.js        # Auto-detection (main entry)
├── checker.js              # Link validation
├── server.js               # Express API server
├── public/                 # Frontend (simple form)
│   ├── index.html
│   └── app.js
├── tests/                  # Test suite
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── CLAUDE.md              # This file (for AI assistants)
└── README.md              # User-facing docs
```

## Common Tasks

### Run Tests
```bash
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:e2e           # E2E tests only
```

### Test Specific Site
```bash
node test-smart-crawler.js
node test-netdata-working.js
```

### Debug Crawler
```bash
# Add console.log in crawler.js, then:
node -e "
const { smartCrawl } = require('./smart-crawler');
smartCrawl('https://example.com').then(console.log);
"
```

## Troubleshooting

### "Only found 1 page" on normal site
- Check if site blocks crawlers (403 errors)
- Verify links are in HTML (not JS-rendered)
- Check robots.txt

### SPA not detected
- Verify sitemap.xml exists
- Check console for detection logs
- Ensure page has 0 links in HTML

### Tests failing on CI
- May be rate-limited by target sites
- Use mocks for unit tests
- Real sites only in E2E (run less often)

## Future Roadmap

### Phase 1: MVP (Now)
- ✅ Core crawler
- ✅ SPA support
- ✅ Testing framework
- 🔄 Deploy to Vercel

### Phase 2: SaaS Features
- User accounts (Clerk)
- Scheduled scans
- Email notifications (Resend)
- Scan history (Supabase)

### Phase 3: Premium
- API access
- Webhooks
- Team features
- Priority support

## Contributing

This is a solo project but built in the open.

**If you want to help:**
1. Star the repo
2. Report bugs (with test cases!)
3. Suggest real sites to test against
4. Submit PRs (with tests!)

## Philosophy in Practice

**Example: Should we cache sitemap results?**

❌ **No** (adds complexity)
- Sitemaps change rarely
- Fetching is fast (<1 second)
- Caching adds: storage, TTL logic, invalidation
- Benefit: Save 0.5 seconds every scan
- Cost: +100 lines of code, +1 point of failure

✅ **Keep it simple**: Fetch fresh every time

**Example: Should we use a database?**

Current: No database (MVP)
Future: Yes (when we add scheduled scans)

Why wait?
- YAGNI (You Ain't Gonna Need It)
- Every dependency is a liability
- Add it when we actually need it

## Working With Claude (AI Assistant)

**This file is for you!**

When working on this project:
1. **Read this file first** - Understand the philosophy
2. **Follow test-first** - Write tests before features
3. **Keep it simple** - Readable > Clever
4. **Test real sites** - Don't just mock everything
5. **Explain changes** - Good commit messages

**When stuck:**
1. Check existing tests for examples
2. Run tests to see what breaks
3. Add a test for new behavior
4. Make it pass
5. Commit

## Questions?

**"Should I optimize this?"**
→ Is it slow? Does it matter? Is the optimization worth the complexity?

**"Should I add error handling here?"**
→ Yes. Always handle errors gracefully.

**"Should I write a test for this?"**
→ Yes. If it's important enough to code, it's important enough to test.

**"Should I refactor this?"**
→ Are tests green? Will it improve readability? Then yes.

---

**Remember:** Perfect is the enemy of shipped. Build, test, ship, iterate. 🚀
