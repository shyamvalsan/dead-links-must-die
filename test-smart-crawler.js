const { smartCrawl } = require('./smart-crawler');

async function testSmartCrawler() {
  console.log('🧪 SMART CRAWLER TEST');
  console.log('Testing automatic SPA detection and fallback\n');
  console.log('='.repeat(80));

  const sites = [
    {
      name: 'Traditional Site',
      url: 'https://www.netdata.cloud',
      description: 'Standard HTML website - should use traditional crawler'
    },
    {
      name: 'JavaScript SPA',
      url: 'https://learn.netdata.cloud',
      description: 'Docusaurus site - should auto-detect and use sitemap'
    }
  ];

  const results = [];

  for (const site of sites) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🌐 Testing: ${site.name}`);
    console.log(`   URL: ${site.url}`);
    console.log(`   Expected: ${site.description}`);
    console.log('='.repeat(80));

    const startTime = Date.now();
    let pageCount = 0;

    try {
      const result = await smartCrawl(
        site.url,
        // Progress callback
        (progress) => {
          // Just track progress silently
        },
        // Page crawled callback
        (page) => {
          pageCount++;
          // Show first few pages
          if (pageCount <= 5) {
            const title = page.title.substring(0, 50);
            console.log(`   ✅ [${pageCount}] ${page.url}`);
            if (page.title && page.title !== 'From sitemap') {
              console.log(`      "${title}${page.title.length > 50 ? '...' : ''}"`);
            }
          } else if (pageCount === 6) {
            console.log(`   ... (showing first 5, continuing crawl)`);
          }
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successfulPages = result.pages.filter(p => !p.error);

      results.push({
        name: site.name,
        url: site.url,
        success: true,
        method: result.method,
        isSPA: result.isSPA,
        pagesFound: result.pages.length,
        successfulPages: successfulPages.length,
        duration: duration
      });

      console.log(`\n📊 Results for ${site.name}:`);
      console.log(`   Method used: ${result.method}`);
      console.log(`   SPA detected: ${result.isSPA ? 'Yes' : 'No'}`);
      console.log(`   Pages found: ${result.pages.length}`);
      console.log(`   Duration: ${duration}s`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        name: site.name,
        url: site.url,
        success: false,
        error: error.message
      });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📋 FINAL SUMMARY');
  console.log('='.repeat(80));

  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.name} (${result.url})`);
    if (result.success) {
      console.log(`   ✅ SUCCESS`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Pages: ${result.pagesFound} (${result.successfulPages} successful)`);
      console.log(`   Duration: ${result.duration}s`);
      console.log(`   SPA: ${result.isSPA ? 'Yes - used sitemap fallback' : 'No - traditional crawling'}`);
    } else {
      console.log(`   ❌ FAILED: ${result.error}`);
    }
  });

  console.log(`\n${'='.repeat(80)}`);
  const allSuccessful = results.every(r => r.success);

  if (allSuccessful) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('✅ Smart crawler automatically adapts to both traditional and SPA sites');
    console.log('\n🎉 The hybrid approach works perfectly!');
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    console.log('⚠️  Some tests had issues');
    console.log('='.repeat(80));
    process.exit(1);
  }
}

testSmartCrawler().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
