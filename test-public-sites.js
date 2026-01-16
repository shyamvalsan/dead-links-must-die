const { crawlWebsite } = require('./crawler');

async function testSite(url, maxPagesToShow = 15) {
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
        if (Date.now() - lastProgressUpdate > 3000) {
          console.log(`📊 Progress: ${progress.pagesCrawled}/${progress.pagesFound} pages crawled`);
          lastProgressUpdate = Date.now();
        }
      },
      // Page crawled callback
      (page) => {
        pagesDiscovered.add(page.url);
        if (pagesDiscovered.size <= 10 || pagesDiscovered.size % 5 === 0) {
          if (page.error) {
            console.log(`❌ [${pagesDiscovered.size}] ${page.url} - ERROR: ${page.error}`);
          } else {
            console.log(`✅ [${pagesDiscovered.size}] ${page.url}`);
            const title = page.title.substring(0, 60);
            console.log(`   "${title}${page.title.length > 60 ? '...' : ''}"`);
          }
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successfulPages = result.pages.filter(p => !p.error);
    const failedPages = result.pages.filter(p => p.error);

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 CRAWL RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Total pages crawled: ${successfulPages.length}`);
    console.log(`⏱️  Time taken: ${duration}s`);

    if (failedPages.length > 0) {
      console.log(`⚠️  Failed pages: ${failedPages.length}`);
    }

    console.log(`\n📄 Sample of discovered pages (first ${maxPagesToShow}):`);
    successfulPages.slice(0, maxPagesToShow).forEach((page, i) => {
      const title = page.title.substring(0, 50) + (page.title.length > 50 ? '...' : '');
      console.log(`   ${i + 1}. ${page.url}`);
    });

    if (successfulPages.length > maxPagesToShow) {
      console.log(`   ... and ${successfulPages.length - maxPagesToShow} more pages`);
    }

    const success = successfulPages.length > 1;

    if (success) {
      console.log(`\n✅ SUCCESS: Discovered ${successfulPages.length} pages!`);
    } else {
      console.log(`\n❌ FAIL: Only discovered ${successfulPages.length} page(s)`);
    }

    return {
      success,
      pagesCount: successfulPages.length,
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
  console.log('\n🚀 WEB CRAWLER MULTI-PAGE DISCOVERY TEST');
  console.log('Testing the fixed crawler with real websites\n');

  // Test with public sites that allow crawling
  const sites = [
    'https://example.org',
    'https://www.ietf.org'
  ];

  const results = [];

  for (const site of sites) {
    const result = await testSite(site);
    results.push(result);
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
      console.log(`   ❌ FAILED: ${result.error || 'Could not discover multiple pages'}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  const totalPages = results.reduce((sum, r) => sum + (r.pagesCount || 0), 0);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ ${successCount}/${results.length} sites successfully crawled`);
  console.log(`✅ Total pages discovered: ${totalPages}`);

  if (successCount > 0) {
    console.log('\n✅ BUG FIX VERIFIED!');
    console.log('✅ The crawler now properly discovers and crawls multiple pages');
    console.log('✅ The single-page crawl bug has been FIXED!');
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    console.log('\n⚠️  All sites blocked or failed');
    console.log('='.repeat(80));
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
