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
  port: 3400,
  path: '/api/v1/client/features/development/eval',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-token': 'unsecured-edge-api-token',
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
    console.log(JSON.stringify(json, null, 2));
  });
});

req.write(postData);
req.end();
