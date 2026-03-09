const http = require('http');

// Call backend's /api/v1/server/features WITH the edge token
// This is what the Edge SDK's apiClient actually calls
const options = {
  hostname: 'localhost',
  port: 45000,
  path: '/api/v1/server/features?compact=true',
  method: 'GET',
  headers: {
    'x-api-token': 'unsecured-edge-api-token',
    'x-application-name': 'edge-server'
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
      console.log(`Flag: ${f.name}, isEnabled: ${f.isEnabled}, version: ${f.version}, compact: ${f.compact}`);
    }
  });
});

req.end();
