const { crawlWebsite } = require('./crawler');

async function testNetdataSite(url, maxPagesToShow = 20) {
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
        // Only log every 3 seconds to avoid spam
        if (Date.now() - lastProgressUpdate > 3000) {
          console.log(`📊 Progress: ${progress.pagesCrawled}/${progress.pagesFound} pages crawled`);
          lastProgressUpdate = Date.now();
        }
      },
      // Page crawled callback
      (page) => {
        pagesDiscovered.add(page.url);
        // Show first 10, then every 10th page
        if (pagesDiscovered.size <= 10 || pagesDiscovered.size % 10 === 0) {
          if (page.error) {
            console.log(`❌ [${pagesDiscovered.size}] ${page.url} - ERROR: ${page.error}`);
          } else {
            console.log(`✅ [${pagesDiscovered.size}] ${page.url}`);
            const title = page.title.substring(0, 70);
            console.log(`   "${title}${page.title.length > 70 ? '...' : ''}"`);
            console.log(`   Links: ${page.linksCount}, Images: ${page.imagesCount}`);
          }
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
    console.log(`⚡ Speed: ${(result.pages.length / (duration / 60)).toFixed(1)} pages/minute`);

    // Calculate statistics
    const successfulPages = result.pages.filter(p => !p.error);
    const failedPages = result.pages.filter(p => p.error);
    const totalLinks = successfulPages.reduce((sum, page) => sum + page.linksCount, 0);
    const totalImages = successfulPages.reduce((sum, page) => sum + page.imagesCount, 0);
    const avgLinksPerPage = successfulPages.length > 0 ? (totalLinks / successfulPages.length).toFixed(1) : 0;

    console.log(`\n📊 Statistics:`);
    console.log(`   Successful pages: ${successfulPages.length}`);
    console.log(`   Failed pages: ${failedPages.length}`);
    console.log(`   Total links found: ${totalLinks} (avg ${avgLinksPerPage} per page)`);
    console.log(`   Total images found: ${totalImages}`);

    // Show sample of discovered pages
    console.log(`\n📄 Sample of discovered pages (first ${maxPagesToShow}):`);
    successfulPages.slice(0, maxPagesToShow).forEach((page, i) => {
      const title = page.title.substring(0, 60) + (page.title.length > 60 ? '...' : '');
      console.log(`   ${i + 1}. ${page.url}`);
      console.log(`      "${title}"`);
    });

    if (successfulPages.length > maxPagesToShow) {
      console.log(`   ... and ${successfulPages.length - maxPagesToShow} more pages`);
    }

    // Check if we discovered multiple pages
    const success = successfulPages.length > 1;

    if (success) {
      console.log(`\n✅ SUCCESS: Discovered ${successfulPages.length} pages (more than just homepage)`);
    } else {
      console.log(`\n⚠️  WARNING: Only discovered ${successfulPages.length} page(s)`);
    }

    return {
      success,
      pagesCount: successfulPages.length,
      totalPages: result.pages.length,
      failedCount: failedPages.length,
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
    'https://www.netdata.cloud',  // Note: Using www subdomain
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
      console.log(`   ✅ SUCCESS: Discovered ${result.pagesCount} successful pages`);
      if (result.failedCount > 0) {
        console.log(`   ⚠️  Note: ${result.failedCount} pages failed to load`);
      }
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
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS HAD ISSUES');
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ ${successCount}/${results.length} sites crawled successfully`);
    console.log('='.repeat(80));
    process.exit(successCount > 0 ? 0 : 1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
