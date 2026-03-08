const http = require('http');

// Test 1: Edge's server features endpoint (returns raw cached data)
function testEdgeServerFeatures() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3400,
      path: '/api/v1/server/development/features',
      method: 'GET',
      headers: {
        'x-api-token': 'gatrix-unsecured-server-api-token',
        'x-application-name': 'test'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('=== Edge Server Features (raw cache) ===');
        console.log('Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          const flags = json.data?.flags || [];
          for (const f of flags) {
            console.log(`  Flag: ${f.name}, isEnabled: ${f.isEnabled}, version: ${f.version}`);
          }
          if (flags.length === 0) console.log('  (no flags found)');
        } catch (e) {
          console.log('  Error parsing:', data.substring(0, 200));
        }
        resolve();
      });
    });
    req.end();
  });
}

// Test 2: Edge cache internal status - dump all keys 
function testEdgeCacheKeys() {
  return new Promise((resolve) => {
    http.get('http://localhost:3400/internal/cache', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('\n=== Edge Internal Cache ===');
        try {
          const json = JSON.parse(data);
          const summary = json.data?.summary || {};
          console.log('Summary keys:', JSON.stringify(summary, null, 2));
          
          // Check all sections for any data
          const sections = ['featureFlags', 'gameWorlds', 'clientVersions'];
          for (const section of sections) {
            const sectionData = json.data?.[section];
            if (sectionData && typeof sectionData === 'object') {
              const keys = Object.keys(sectionData);
              console.log(`\n${section} cache keys (${keys.length}):`, keys);
            }
          }
        } catch (e) {
          console.log('Error:', e.message);
        }
        resolve();
      });
    });
  });
}

// Test 3: Edge eval to check what cacheKey is being used
function testEdgeEvalWithDebug() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      context: { userId: 'user-12345' }
    });
    const options = {
      hostname: 'localhost',
      port: 3400,
      path: '/api/v1/client/features/development/eval',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': 'gatrix-unsecured-edge-api-token',
        'x-application-name': 'test-app',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('\n=== Edge Client Eval ===');
        console.log('Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          const flags = json.data?.flags || [];
          for (const f of flags) {
            console.log(`  Flag: ${f.name}, enabled: ${f.enabled}, version: ${f.version}`);
          }
          console.log('  meta:', JSON.stringify(json.meta));
        } catch (e) {
          console.log('Error:', e.message);
        }
        resolve();
      });
    });
    req.write(postData);
    req.end();
  });
}

async function main() {
  await testEdgeServerFeatures();
  await testEdgeCacheKeys();
  await testEdgeEvalWithDebug();
}

main().catch(console.error);
