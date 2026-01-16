const { crawlWebsite } = require('./crawler');

// Test the crawler with a simple test site
async function testCrawler() {
  // Use quotes.toscrape.com - a simple test site designed for web scraping with multiple pages
  const testUrl = 'http://quotes.toscrape.com/';
  console.log(`🧪 Testing crawler with ${testUrl}`);
  console.log('================================================\n');

  const startTime = Date.now();

  try {
    const result = await crawlWebsite(
      testUrl,
      // Progress callback
      (progress) => {
        console.log(`📊 Progress: ${progress.pagesCrawled}/${progress.pagesFound} pages crawled`);
      },
      // Page crawled callback
      (page) => {
        console.log(`✅ Crawled: ${page.url}`);
        console.log(`   Title: ${page.title}`);
        console.log(`   Links: ${page.linksCount}, Images: ${page.imagesCount}`);
        console.log(`   Total resources: ${page.links.length}`);
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

    // Test validation
    if (result.pages.length > 1) {
      console.log('\n✅ SUCCESS: Crawler discovered multiple pages!');
      process.exit(0);
    } else {
      console.log('\n❌ FAIL: Crawler only found 1 page (the homepage)');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testCrawler();
