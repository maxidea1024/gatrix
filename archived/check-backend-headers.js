const http = require('http');

// Test what the backend ACTUALLY returns to the Edge SDK
// Including headers (especially ETag)
const options = {
  hostname: 'localhost',
  port: 45000,
  path: '/api/v1/server/features?compact=true',
  method: 'GET',
  headers: {
    'x-api-token': 'gatrix-unsecured-edge-api-token',
    'x-application-name': 'edge-server'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('ETag header:', res.headers['etag'] || 'NONE');
    console.log('Response headers:', JSON.stringify(res.headers, null, 2));
    
    const json = JSON.parse(data);
    const flags = json.data?.flags || [];
    for (const f of flags) {
      console.log(`Flag: ${f.name}, isEnabled: ${f.isEnabled}, version: ${f.version}`);
    }
  });
});

req.end();
