const { crawlWebsite } = require('./crawler');

async function testNetdataSite(url) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing crawler with ${url}`);
  console.log('='.repeat(80));

  const startTime = Date.now();
  const pagesDiscovered = new Set();
  let lastProgressUpdate = Date.now();

  try {
    const result = await crawlWebsite(
      url,
      // Progress callback
      (progress) => {
        // Only log every 2 seconds to avoid spam
        if (Date.now() - lastProgressUpdate > 2000) {
          console.log(`📊 Progress: ${progress.pagesCrawled}/${progress.pagesFound} pages crawled`);
          lastProgressUpdate = Date.now();
        }
      },
      // Page crawled callback
      (page) => {
        pagesDiscovered.add(page.url);
        if (pagesDiscovered.size <= 10 || pagesDiscovered.size % 10 === 0) {
          console.log(`✅ [${pagesDiscovered.size}] ${page.url}`);
          console.log(`   Title: ${page.title.substring(0, 60)}${page.title.length > 60 ? '...' : ''}`);
          console.log(`   Links: ${page.linksCount}, Images: ${page.imagesCount}`);
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 CRAWL RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Total pages discovered: ${result.pages.length}`);
    console.log(`✅ Total URLs visited: ${result.crawledUrls.size}`);
    console.log(`⏱️  Time taken: ${duration}s`);

    // Calculate statistics
    const totalLinks = result.pages.reduce((sum, page) => sum + page.linksCount, 0);
    const totalImages = result.pages.reduce((sum, page) => sum + page.imagesCount, 0);
    const avgLinksPerPage = (totalLinks / result.pages.length).toFixed(1);

    console.log(`📊 Total links found: ${totalLinks} (avg ${avgLinksPerPage} per page)`);
    console.log(`🖼️  Total images found: ${totalImages}`);

    // Show sample of discovered pages
    console.log(`\n📄 Sample of discovered pages (first 15):`);
    result.pages.slice(0, 15).forEach((page, i) => {
      const title = page.title.substring(0, 50) + (page.title.length > 50 ? '...' : '');
      console.log(`   ${i + 1}. ${page.url}`);
      console.log(`      "${title}"`);
    });

    if (result.pages.length > 15) {
      console.log(`   ... and ${result.pages.length - 15} more pages`);
    }

    return {
      success: result.pages.length > 1,
      pagesCount: result.pages.length,
      url: url
    };

  } catch (error) {
    console.error(`❌ Test failed for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
}

async function runTests() {
  console.log('\n🚀 NETDATA CRAWLER TEST SUITE');
  console.log('Testing the fixed crawler with real Netdata domains\n');

  const sites = [
    'https://netdata.cloud',
    'https://learn.netdata.cloud'
  ];

  const results = [];

  for (const site of sites) {
    const result = await testNetdataSite(site);
    results.push(result);

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📋 FINAL SUMMARY');
  console.log('='.repeat(80));

  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.url}`);
    if (result.success) {
      console.log(`   ✅ SUCCESS: Discovered ${result.pagesCount} pages`);
    } else {
      console.log(`   ❌ FAILED: ${result.error || 'Only found homepage'}`);
    }
  });

  const allSuccessful = results.every(r => r.success);
  const totalPages = results.reduce((sum, r) => sum + (r.pagesCount || 0), 0);

  console.log(`\n${'='.repeat(80)}`);
  if (allSuccessful) {
    console.log('✅ ALL TESTS PASSED!');
    console.log(`✅ The crawler successfully discovered multiple pages on all ${results.length} domains`);
    console.log(`✅ Total pages crawled across all sites: ${totalPages}`);
    console.log('✅ The bug is FIXED - crawler now properly discovers internal links!');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('❌ The crawler may still have issues with certain sites');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
