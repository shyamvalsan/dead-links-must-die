# 💀 Dead Links Must Die

A simple, no-nonsense tool that hunts down broken links and dead images on your website. Because nothing says "unprofessional" quite like a 404 page your visitors weren't expecting.

## What Does It Do?

Ever wondered if your website has broken links lurking in the shadows? This tool will find them for you. Just point it at any website, and it'll:

1. **Crawl** through every page it can find on your site
2. **Check** every single link and image to make sure they actually work
3. **Report** back with detailed information about what's broken, what's redirecting, and what's working just fine

All with real-time progress updates and an ETA so you're not left wondering if it froze or if your site just has *that* many pages.

## Features

- **Blazing Fast**: Checks up to 100 links simultaneously with massive parallelization
- **Smart Optimization**: Skips checking internal links that were successfully crawled (50-80% time savings!)
- **Parallel Crawling**: Crawls up to 20 pages at once for rapid site discovery
- **Real-Time Results**: See broken links appear instantly as they're found - no waiting for the scan to complete
- **Automatic Discovery**: Finds all pages on your website automatically by following internal links
- **Comprehensive Checking**: Tests every link and image for accessibility
- **Live Progress Tracking**: Watch as it crawls and checks, with live stats and estimated time remaining
- **Detailed Reports**: Get a full breakdown of broken links, redirects, and which pages have issues
- **Clean Interface**: Simple, distraction-free UI with smooth animations
- **Scales Up**: Can handle 10,000+ pages (configurable limit)

## Installation

You'll need [Node.js](https://nodejs.org/) installed (version 14 or newer should work fine).

```bash
# Clone this repository
git clone https://github.com/yourusername/dead-links-must-die.git

# Navigate into the directory
cd dead-links-must-die

# Install dependencies
npm install

# Start the server
npm start
```

That's it. The app will start running on `http://localhost:3000` (or the next available port if 3000 is in use).

**Note**: If port 3000 is already taken, the app will automatically try ports 3001-3010. You can also manually specify a port:

```bash
PORT=8080 npm start
```

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Enter the URL of the website you want to check
3. Click "Start Scan" and grab a coffee (or tea, we don't judge)
4. Watch the progress as it crawls and checks links
5. Review the detailed report when it's done

## What Gets Checked?

- **All internal pages**: Every page on your domain that can be reached by following links
- **All links**: Every `<a>` tag with an `href` attribute, whether internal or external
- **All images**: Every `<img>` tag with a `src` attribute

## What Counts as "Broken"?

A link is considered broken if:
- It returns a 4xx status code (404, 403, etc.)
- It returns a 5xx status code (500, 503, etc.)
- The request times out or fails to connect
- The URL is malformed

Redirects (3xx status codes) are tracked separately since they technically work but might indicate outdated links.

## How Long Does It Take?

Thanks to massive parallelization, scans are **20-50x faster** than traditional sequential checkers:

- **Small sites (< 50 pages)**: 1-3 minutes
- **Medium sites (50-500 pages)**: 5-15 minutes
- **Large sites (500-2000 pages)**: 15-30 minutes
- **Huge sites (2000-10000 pages)**: 30-60 minutes

The app shows you:
- Live broken links as they're discovered (no waiting!)
- Real-time progress with accurate ETA
- How many links are being skipped (internal pages already validated)

## Performance Optimizations

The scanner uses several clever tricks to be blazingly fast:

- **100 parallel link checks** - Tests 100 links at once instead of one-by-one
- **20 parallel crawlers** - Discovers pages 20x faster
- **Smart link skipping** - Internal pages that were successfully crawled don't need re-checking (50-80% time savings!)
- **Fast timeouts** - 3-second timeouts instead of 15+ seconds
- **HEAD requests only** - Lighter than full GET requests

## Limitations

- **10,000 page limit**: Configurable safety limit to prevent runaway crawls (can be adjusted in code)
- **Same domain only**: Only crawls pages on the same domain as your starting URL
- **Timeout**: Requests that take longer than 3 seconds are marked as failed (fast fail)
- **JavaScript-heavy sites**: Doesn't execute JavaScript, so dynamically loaded content won't be checked

## Technical Details

Built with:
- **Node.js** and **Express** for the backend
- **Cheerio** for HTML parsing
- **Axios** for HTTP requests with massive parallelization
- Vanilla **JavaScript** for the frontend (no heavy frameworks needed)
- **Server-Sent Events** (SSE) for real-time progress and broken link streaming

**Architecture:**
- Parallel crawler with concurrency control (20 simultaneous page fetches)
- Parallel link checker with batch processing (100 simultaneous link checks)
- Smart deduplication to avoid checking internal links twice
- Real-time event streaming for instant feedback

## Why Did I Build This?

Because I got tired of manually checking links and dealing with overly complicated tools that require accounts, subscriptions, or have arbitrary limits. Sometimes you just need a simple tool that does one thing well.

## Contributing

Found a bug? Have an idea for improvement? Pull requests are welcome! This is a simple project, so let's keep it that way.

## License

MIT License - see the [LICENSE](LICENSE) file for details. Use it, modify it, share it. Just don't blame me if it finds more broken links than you were hoping for.

## Disclaimer

This tool makes HTTP requests to URLs found on the website you're checking. Use it responsibly and make sure you have permission to scan the website in question. Don't use it to hammer servers or check sites you don't own without permission.

---

Built with ❤️ and a healthy dislike for broken links.
