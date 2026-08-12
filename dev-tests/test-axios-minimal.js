const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testMinimal() {
  const url = 'https://www.netdata.cloud';

  // Get proxy from environment
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
  console.log('Testing axios request to:', url);
  console.log('Using proxy:', proxyUrl ? 'Yes' : 'No');

  try {
    // Test 1: With proxy and minimal headers (like curl)
    console.log('\nTest 1: Minimal request with proxy');
    const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const response = await axios.get(url, {
      httpsAgent: httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content length:', response.data.length);

  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Status code:', error.response.status);
      console.log('Response headers:', error.response.headers);
    }

    // Try to understand what's different
    console.log('\nRequest details that were sent:');
    if (error.config) {
      console.log('Method:', error.config.method);
      console.log('URL:', error.config.url);
      console.log('Headers:', JSON.stringify(error.config.headers, null, 2));
    }
  }
}

testMinimal();
