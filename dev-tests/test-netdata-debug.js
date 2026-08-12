const { crawlWebsite } = require('./crawler');

async function testWithDebug(url) {
  console.log(`\n🔍 Testing ${url} with detailed error logging\n`);

  try {
    const result = await crawlWebsite(
      url,
      (progress) => {
        console.log(`Progress: ${progress.pagesCrawled}/${progress.pagesFound}`);
      },
      (page) => {
        if (page.error) {
          console.log(`❌ Error crawling ${page.url}:`);
          console.log(`   Error: ${page.error}`);
        } else {
          console.log(`✅ Successfully crawled: ${page.url}`);
          console.log(`   Title: ${page.title}`);
          console.log(`   Links: ${page.linksCount}, Images: ${page.imagesCount}`);
        }
      }
    );

    console.log(`\nResult: ${result.pages.length} pages discovered`);

    // Show all errors
    const errors = result.pages.filter(p => p.error);
    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(page => {
        console.log(`   ${page.url}: ${page.error}`);
      });
    }

    return result;

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}

async function main() {
  console.log('🧪 NETDATA DEBUG TEST');
  console.log('Testing network connectivity and error diagnosis\n');

  const sites = [
    'https://netdata.cloud',
    'https://learn.netdata.cloud'
  ];

  for (const site of sites) {
    await testWithDebug(site);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch(console.error);
