const { crawlWebsite } = require('./crawler');
const express = require('express');
const path = require('path');

// Create a simple test server with multiple pages
function createTestServer() {
  const app = express();

  // Home page with links to other pages
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Home Page</title></head>
        <body>
          <h1>Welcome to Test Site</h1>
          <nav>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/products">Products</a>
          </nav>
          <img src="/images/logo.png" alt="Logo">
        </body>
      </html>
    `);
  });

  // About page with links
  app.get('/about', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>About Us</title></head>
        <body>
          <h1>About Us</h1>
          <nav>
            <a href="/">Home</a>
            <a href="/contact">Contact</a>
            <a href="/team">Team</a>
          </nav>
          <p>Learn more about us</p>
        </body>
      </html>
    `);
  });

  // Contact page
  app.get('/contact', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Contact</title></head>
        <body>
          <h1>Contact Us</h1>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
          <p>Get in touch</p>
        </body>
      </html>
    `);
  });

  // Products page
  app.get('/products', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Products</title></head>
        <body>
          <h1>Our Products</h1>
          <nav>
            <a href="/">Home</a>
            <a href="/products/widget">Widget</a>
          </nav>
        </body>
      </html>
    `);
  });

  // Team page
  app.get('/team', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Team</title></head>
        <body>
          <h1>Our Team</h1>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </body>
      </html>
    `);
  });

  // Product detail page
  app.get('/products/widget', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Widget Product</title></head>
        <body>
          <h1>Widget Details</h1>
          <nav>
            <a href="/">Home</a>
            <a href="/products">Products</a>
          </nav>
        </body>
      </html>
    `);
  });

  return app;
}

// Test the crawler
async function testCrawler() {
  console.log('🧪 Testing crawler with local test server');
  console.log('================================================\n');

  // Start test server
  const app = createTestServer();
  const server = app.listen(0); // Use random available port
  const port = server.address().port;
  const testUrl = `http://localhost:${port}`;

  console.log(`✅ Test server started on ${testUrl}\n`);

  const startTime = Date.now();
  let pageCount = 0;

  try {
    const result = await crawlWebsite(
      testUrl,
      // Progress callback
      (progress) => {
        console.log(`📊 Progress: ${progress.pagesCrawled}/${progress.pagesFound} pages crawled`);
      },
      // Page crawled callback
      (page) => {
        pageCount++;
        console.log(`✅ Crawled: ${page.url}`);
        console.log(`   Title: ${page.title}`);
        console.log(`   Links: ${page.linksCount}, Images: ${page.imagesCount}`);
        console.log('');
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n================================================');
    console.log('✅ Crawler test completed!');
    console.log('================================================');
    console.log(`Total pages discovered: ${result.pages.length}`);
    console.log(`Total URLs visited: ${result.crawledUrls.size}`);
    console.log(`Time taken: ${duration}s`);
    console.log('\nPages crawled:');
    result.pages.forEach((page, i) => {
      console.log(`${i + 1}. ${page.url} (${page.title})`);
    });

    // Close server
    server.close();

    // Test validation
    console.log('\n================================================');
    if (result.pages.length >= 5) {
      console.log('✅ SUCCESS: Crawler discovered multiple pages (expected ~6, found ' + result.pages.length + ')');
      console.log('✅ The bug is FIXED! The crawler now properly discovers all linked pages.');
      process.exit(0);
    } else {
      console.log('❌ FAIL: Crawler only found ' + result.pages.length + ' page(s), expected at least 5');
      console.log('   This suggests the crawler is still not discovering all internal links.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    server.close();
    process.exit(1);
  }
}

testCrawler();
