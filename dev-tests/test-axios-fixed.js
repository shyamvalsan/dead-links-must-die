const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testFixed() {
  const url = 'https://www.netdata.cloud';
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;

  console.log('Testing FIXED axios request to:', url);
  console.log('Using proxy:', proxyUrl ? 'Yes' : 'No');

  try {
    const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const response = await axios.get(url, {
      httpsAgent: httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content length:', response.data.length);
    console.log('\n🎉 The Accept header fix works!');

  } catch (error) {
    console.log('❌ Still failing:', error.message);
    if (error.response) {
      console.log('Status code:', error.response.status);
    }
  }
}

testFixed();
