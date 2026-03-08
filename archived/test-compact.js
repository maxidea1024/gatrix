const http = require('http');

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Test with compact=true (what Edge SDK sends)
  console.log('=== With compact=true ===');
  const r1 = await makeRequest({
    hostname: 'localhost', port: 45000,
    path: '/api/v1/server/features?compact=true',
    method: 'GET',
    headers: { 'x-api-token': 'gatrix-unsecured-edge-api-token', 'x-application-name': 'edge-server' }
  });
  const j1 = JSON.parse(r1.body);
  console.log('Full response:');
  console.log(JSON.stringify(j1, null, 2));

  // Test without compact (to compare)
  console.log('\n=== Without compact ===');
  const r2 = await makeRequest({
    hostname: 'localhost', port: 45000,
    path: '/api/v1/server/features',
    method: 'GET',
    headers: { 'x-api-token': 'gatrix-unsecured-edge-api-token', 'x-application-name': 'edge-server' }
  });
  const j2 = JSON.parse(r2.body);
  const flags2 = j2.data?.flags || [];
  for (const f of flags2) {
    console.log(`  Flag: ${f.name}, isEnabled: ${f.isEnabled}, version: ${f.version}`);
  }
}

main().catch(console.error);
