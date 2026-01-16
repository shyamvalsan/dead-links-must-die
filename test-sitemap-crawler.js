const { discoverFromSitemap } = require('./sitemap-crawler');

async function testSitemapCrawler() {
  console.log('🧪 SITEMAP CRAWLER TEST');
  console.log('Testing sitemap-based page discovery for JavaScript SPAs\n');
  console.log('='.repeat(80));

  // Test with learn.netdata.cloud (Docusaurus SPA)
  const startTime = Date.now();
  const pages = await discoverFromSitemap('https://learn.netdata.cloud');
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('='.repeat(80));
  console.log('\n📊 RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Total pages discovered: ${pages.length}`);
  console.log(`⏱️  Time taken: ${duration}s`);

  // Show sample of discovered pages
  console.log(`\n📄 Sample of discovered pages (first 30):`);
  pages.slice(0, 30).forEach((page, i) => {
    console.log(`   ${i + 1}. ${page.url}`);
  });

  if (pages.length > 30) {
    console.log(`   ... and ${pages.length - 30} more pages`);
  }

  console.log('\n='.repeat(80));
  if (pages.length > 100) {
    console.log('✅ SUCCESS: Discovered hundreds of pages from JavaScript SPA!');
    console.log('✅ This is the recommended approach for Docusaurus/React sites');
  } else if (pages.length > 1) {
    console.log(`✅ SUCCESS: Discovered ${pages.length} pages from sitemap`);
  } else {
    console.log('⚠️  Only found a few pages - sitemap may be limited');
  }
  console.log('='.repeat(80));
}

testSitemapCrawler().catch(console.error);
