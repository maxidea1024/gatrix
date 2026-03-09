const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // 1. Backend API: What does the backend actually return for this flag?
  console.log('=== 1. Backend Server Features API (what Edge SDK fetches) ===');
  const backendResp = await makeRequest({
    hostname: 'localhost', port: 45000,
    path: '/api/v1/server/features?compact=true',
    method: 'GET',
    headers: { 'x-api-token': 'unsecured-edge-api-token', 'x-application-name': 'edge-server' }
  });
  const backendJson = JSON.parse(backendResp.body);
  const backendFlags = backendJson.data?.flags || [];
  for (const f of backendFlags) {
    console.log(`  Backend flag: ${f.name}, isEnabled: ${f.isEnabled}, version: ${f.version}`);
  }
  console.log(`  ETag: ${backendResp.headers['etag'] || 'NONE'}`);

  // 2. Edge Server Features (raw cached data)
  console.log('\n=== 2. Edge Server Features (raw cached data for development) ===');
  const edgeServerResp = await makeRequest({
    hostname: 'localhost', port: 3400,
    path: '/api/v1/server/development/features',
    method: 'GET',
    headers: { 'x-api-token': 'unsecured-server-api-token', 'x-application-name': 'test' }
  });
  const edgeServerJson = JSON.parse(edgeServerResp.body);
  const edgeFlags = edgeServerJson.data?.flags || [];
  for (const f of edgeFlags) {
    console.log(`  Edge cached: ${f.name}, isEnabled: ${f.isEnabled}, version: ${f.version}`);
  }

  // 3. Edge Client Eval 
  console.log('\n=== 3. Edge Client Eval (evaluation result) ===');
  const evalResp = await makeRequest({
    hostname: 'localhost', port: 3400,
    path: '/api/v1/client/features/development/eval',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-token': 'unsecured-edge-api-token', 
      'x-application-name': 'test-app',
    }
  }, JSON.stringify({ context: { userId: 'test-user' } }));
  const evalJson = JSON.parse(evalResp.body);
  const evalFlags = evalJson.data?.flags || [];
  for (const f of evalFlags) {
    console.log(`  Eval result: ${f.name}, enabled: ${f.enabled}, version: ${f.version}, variant: ${f.variant?.name}`);
  }

  // 4. Compare
  console.log('\n=== 4. COMPARISON ===');
  for (const bf of backendFlags) {
    const ef = edgeFlags.find(f => f.name === bf.name);
    const ev = evalFlags.find(f => f.name === bf.name);
    console.log(`  Flag: ${bf.name}`);
    console.log(`    Backend API isEnabled: ${bf.isEnabled}`);
    console.log(`    Edge cached isEnabled: ${ef ? ef.isEnabled : 'NOT FOUND'}`);
    console.log(`    Edge eval enabled:     ${ev ? ev.enabled : 'NOT FOUND'}`);
    if (bf.isEnabled !== ef?.isEnabled) {
      console.log(`    *** MISMATCH! Backend says ${bf.isEnabled}, Edge cache says ${ef?.isEnabled} ***`);
    }
  }
}

main().catch(console.error);
