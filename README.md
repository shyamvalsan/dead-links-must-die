# 💀 Dead Links Must Die

A simple, no-nonsense tool that hunts down broken links and dead images on your website. Because nothing says "unprofessional" quite like a 404 page your visitors weren't expecting.

## What Does It Do?

Ever wondered if your website has broken links lurking in the shadows? This tool will find them for you. Just point it at any website, and it'll:

1. **Crawl** through every page it can find on your site
2. **Check** every single link and image to make sure they actually work
3. **Report** back with detailed information about what's broken, what's redirecting, and what's working just fine

All with real-time progress updates and an ETA so you're not left wondering if it froze or if your site just has *that* many pages.

## Features

- **Automatic Discovery**: Finds all pages on your website automatically by following internal links
- **Comprehensive Checking**: Tests every link and image for accessibility
- **Real-Time Progress**: Watch as it crawls and checks, with live stats and estimated time remaining
- **Detailed Reports**: Get a full breakdown of broken links, redirects, and which pages have issues
- **Clean Interface**: Simple, distraction-free UI that just works
- **Fast**: Checks multiple links simultaneously to get you results quickly

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

It depends on your website:
- Small sites (< 10 pages): Usually under a minute
- Medium sites (10-50 pages): A few minutes
- Large sites (50+ pages): Could be 5-15 minutes or more

The app shows you an estimated time remaining as it works, so you'll know what to expect.

## Limitations

- **500 page limit**: To prevent infinite crawls, the tool stops after discovering 500 pages
- **Same domain only**: Only crawls pages on the same domain as your starting URL
- **Timeout**: Requests that take longer than 15 seconds are marked as failed
- **JavaScript-heavy sites**: Doesn't execute JavaScript, so dynamically loaded content won't be checked

## Technical Details

Built with:
- **Node.js** and **Express** for the backend
- **Cheerio** for HTML parsing
- **Axios** for HTTP requests
- Vanilla **JavaScript** for the frontend (no heavy frameworks needed)
- **Server-Sent Events** (SSE) for real-time progress updates

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
