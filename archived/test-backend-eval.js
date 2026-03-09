const http = require('http');

const postData = JSON.stringify({
  context: {
    userId: 'user-12345',
    sessionId: 'session-abcde',
    store: 'appstore',
    vipTier: 10
  }
});

const options = {
  hostname: 'localhost',
  port: 45000,
  path: '/api/v1/client/features/eval',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-token': 'unsecured-client-api-token',
    'x-application-name': 'test-app',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const json = JSON.parse(data);
    const flags = json.data?.flags || [];
    for (const f of flags) {
      if (f.name === 'new-feature-0tsj') {
        console.log('Backend flag:', JSON.stringify(f, null, 2));
      }
    }
  });
});

req.write(postData);
req.end();
