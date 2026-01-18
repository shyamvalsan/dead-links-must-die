# Testing Strategy

## Overview

Dead Links Must Die follows a comprehensive test-first development approach with three layers of testing:

1. **Unit Tests** - Fast, isolated tests of individual functions
2. **Integration Tests** - Tests of components working together
3. **End-to-End Tests** - Real-world scenarios and full workflow validation

## Test Statistics

**Total Tests: 48 (all passing)**

- 13 Unit Tests
- 16 Integration Tests
- 19 End-to-End Tests
- 7 Browser E2E Tests (created, require server)

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only (fast, ~10s)
npm run test:integration   # Integration tests (~20s)
npm run test:e2e           # End-to-end tests (~2min)

# Interactive UI mode
npm run test:ui

# Generate HTML report
npm test && npm run test:report
```

## Test Coverage

### Unit Tests (tests/unit/)

**checker.spec.js** - Link checker validation
- ✅ Identifies 404 broken links
- ✅ Identifies 500 server errors as broken
- ✅ Treats 403/401 as warnings, not broken links
- ✅ Detects redirects
- ✅ Skips internal links that were already crawled
- ✅ Handles DNS failures for dead domains
- ✅ Provides summary statistics
- ✅ Tracks link occurrences across multiple pages

**smart-crawler.spec.js** - SPA detection logic
- ✅ Detects SPA when only 1 page with 0 links found
- ✅ Does not detect SPA when multiple pages found
- ✅ Does not detect SPA when page has links
- ✅ Handles error pages correctly
- ✅ Handles empty result

### Integration Tests (tests/integration/)

**traditional-site.spec.js** - HTML crawling
- ✅ Discovers all interconnected pages
- ✅ Extracts links from each page
- ✅ Handles relative URLs correctly
- ✅ Does not duplicate pages

**spa-site.spec.js** - SPA sitemap crawling
- ✅ Detects SPA and falls back to sitemap
- ✅ Discovers pages from sitemap
- ✅ Fetches sitemap pages and extracts links
- ✅ Extracts correct page titles from sitemap pages

**full-check.spec.js** - Complete crawl + link checking
- ✅ Crawls site and identifies all broken links
- ✅ Correctly categorizes broken links vs warnings
- ✅ Skips internal links that were already crawled
- ✅ Handles redirects correctly
- ✅ Provides per-page breakdown of broken links
- ✅ Tracks where each broken link appears
- ✅ Handles images correctly
- ✅ Provides accurate summary statistics

### End-to-End Tests (tests/e2e/)

**real-sites.spec.js** - Real production websites
- ✅ Crawls www.netdata.cloud (traditional site, 1900+ pages)
- ✅ Crawls learn.netdata.cloud (Docusaurus SPA, 800+ pages)
- ✅ Handles bare domain redirects
- ✅ Crawls example.com (simple site)
- ✅ Crawls httpbin.org (testing site)
- ✅ Handles sites with mixed content
- ✅ Handles non-existent domains gracefully
- ✅ Handles sites without sitemap gracefully
- ✅ Full workflow on httpbin.org (crawl → check links)
- ✅ Identifies broken links on test sites
- ✅ Handles sites with many redirects
- ✅ Provides comprehensive summary statistics
- ✅ Crawls static documentation sites
- ✅ Handles HTTP vs HTTPS redirects
- ✅ Handles sites with query parameters
- ✅ Handles sites with hash fragments

**complete-flow.spec.js** - Full pipeline validation
- ✅ FULL FLOW: Crawl → Extract Links → Check Links → Report
- ✅ Verifies broken link appears in correct page results
- ✅ Tracks same broken link across multiple pages

**browser-user-flow.spec.js** - Real browser automation (created, requires server)
- User can submit URL and see crawling progress
- User can see discovered pages count
- User can see broken links in results
- User can see results table or list
- User sees error message for invalid URL
- Results show both working and broken links statistics
- Can start a new scan after completing one

## Test Philosophy

### Test-First Development

From CLAUDE.md:

> Write tests BEFORE features. Real-world tests with actual sites (not just mocks). Playwright for end-to-end user flows. Tests run on every commit via GitHub Actions.

### Real-World Testing

We test against actual production websites to catch real issues:

- **Traditional Sites**: www.netdata.cloud (1900+ pages)
- **JavaScript SPAs**: learn.netdata.cloud (800+ pages with sitemap)
- **Simple Sites**: example.com, httpbin.org
- **Edge Cases**: Redirects, query params, hash fragments, dead domains

### What We Test

**✅ Must Test:**
- Core crawler logic (page discovery, link extraction)
- SPA detection and sitemap fallback
- Link validation (200 OK vs 404/500/etc)
- Error handling and edge cases
- Real-world sites with known characteristics

**❌ Don't Test:**
- Third-party libraries (trust them)
- Trivial getters/setters
- Private implementation details

## Test Structure

```
tests/
├── unit/                    # Fast, isolated tests
│   ├── checker.spec.js      # Link validation logic
│   └── smart-crawler.spec.js # SPA detection
│
├── integration/             # Components working together
│   ├── traditional-site.spec.js
│   ├── spa-site.spec.js
│   └── full-check.spec.js   # Crawl + check pipeline
│
└── e2e/                     # Real-world scenarios
    ├── real-sites.spec.js    # Production websites
    ├── complete-flow.spec.js # Full workflow validation
    └── browser-user-flow.spec.js # Browser automation
```

## Continuous Integration

Tests run automatically on every commit via GitHub Actions.

## Adding New Tests

When adding a new feature:

1. **Write the test first** (it should fail)
2. **Run the test** to verify it fails
3. **Write minimal code** to make it pass
4. **Refactor** if needed (keeping tests green)
5. **Commit** with descriptive message

Example:

```javascript
// tests/unit/new-feature.spec.js
test('new feature does X', async () => {
  const result = await newFeature();
  expect(result).toBe(expected);
});
```

Then implement the feature to make the test pass.

## Troubleshooting

### Tests Failing on CI

External sites may be rate-limited or down. Use mocks for unit tests, real sites only in E2E (run less often).

### DNS Failures

Localhost and 127.0.0.1 are exempt from DNS checks. External domains may fail DNS in restricted environments.

### Flaky Tests

E2E tests against real sites may be flaky. Run them less frequently or use retries (configured in playwright.config.js).

## Test Coverage Goals

- **Unit Tests**: >90% coverage of core logic
- **Integration Tests**: All major workflows covered
- **E2E Tests**: Critical user paths + diverse real-world sites

## Future Test Improvements

- [ ] Add performance benchmarks
- [ ] Add load testing (crawl 10,000+ page sites)
- [ ] Add security testing (XSS, injection, etc.)
- [ ] Expand browser E2E tests when frontend is stable
- [ ] Add accessibility testing
- [ ] Add visual regression testing

---

**Remember**: If it's important enough to code, it's important enough to test. 🚀
