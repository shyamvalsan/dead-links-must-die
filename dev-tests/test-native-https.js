const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testNativeHttps() {
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
  console.log('Testing native HTTPS request');
  console.log('Proxy:', proxyUrl ? 'configured' : 'none');

  const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

  const options = {
    hostname: 'www.netdata.cloud',
    port: 443,
    path: '/',
    method: 'GET',
    agent: agent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DeadLinkChecker/4.0; +https://github.com/deadlinks)',
      'Accept': '*/*',
      'Host': 'www.netdata.cloud'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('\n✅ Response received!');
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Content length:', data.length);
        console.log('\n🎉 Native HTTPS works!');
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log('❌ Error:', error.message);
      reject(error);
    });

    req.end();
  });
}

testNativeHttps().catch(console.error);
