/**
 * Edge Server Heavy Load Test
 * Usage: node edge-stress-test.js [concurrent] [duration]
 * Example: node edge-stress-test.js 100 30
 */

const http = require('http');

const CONCURRENT = parseInt(process.argv[2]) || 100;
const DURATION_SEC = parseInt(process.argv[3]) || 30;
const BASE_URL = 'http://localhost:51337';

const headers = {
  'x-api-token': 'gatrix-unsecured-server-api-token',
  'x-application-name': 'stress-test',
  'x-environment-id': '01KBP3PMDF4MJPKYVX7ER1VMSH',
};

const endpoints = [
  { path: '/health', auth: false },
  { path: '/api/v1/client/game-worlds', auth: false },
  { path: '/api/v1/client/cache-stats', auth: false },
  { path: '/api/v1/client/test', auth: true },
  { path: '/api/v1/client/client-version?platform=android&version=latest', auth: true },
  { path: '/api/v1/client/banners', auth: true },
  { path: '/api/v1/client/versions', auth: true },
  { path: '/api/v1/client/notices', auth: true },
];

const stats = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  byEndpoint: {},
};

endpoints.forEach((ep) => {
  stats.byEndpoint[ep.path] = { success: 0, failed: 0, latencies: [] };
});

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const start = Date.now();
    const options = {
      hostname: 'localhost',
      port: 51337,
      path: endpoint.path,
      method: 'GET',
      headers: endpoint.auth ? headers : {},
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latency = Date.now() - start;
        const success = res.statusCode === 200 || res.statusCode === 404;

        stats.total++;
        stats.latencies.push(latency);
        stats.byEndpoint[endpoint.path].latencies.push(latency);

        if (success) {
          stats.success++;
          stats.byEndpoint[endpoint.path].success++;
        } else {
          stats.failed++;
          stats.byEndpoint[endpoint.path].failed++;
        }
        resolve();
      });
    });

    req.on('error', () => {
      const latency = Date.now() - start;
      stats.total++;
      stats.failed++;
      stats.latencies.push(latency);
      stats.byEndpoint[endpoint.path].failed++;
      stats.byEndpoint[endpoint.path].latencies.push(latency);
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      stats.total++;
      stats.failed++;
      stats.byEndpoint[endpoint.path].failed++;
      resolve();
    });

    req.end();
  });
}

async function worker(endTime) {
  while (Date.now() < endTime) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    await makeRequest(endpoint);
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  // Sample if too many elements to avoid stack overflow
  let data = arr;
  if (arr.length > 10000) {
    data = [];
    const step = Math.floor(arr.length / 10000);
    for (let i = 0; i < arr.length; i += step) {
      data.push(arr[i]);
    }
  }
  const sorted = data.slice().sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function main() {
  console.log('=== Edge Server Heavy Load Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent Workers: ${CONCURRENT}`);
  console.log(`Duration: ${DURATION_SEC} seconds`);
  console.log('');

  const startTime = Date.now();
  const endTime = startTime + DURATION_SEC * 1000;

  console.log(`Starting ${CONCURRENT} workers...`);

  const workers = [];
  for (let i = 0; i < CONCURRENT; i++) {
    workers.push(worker(endTime));
  }

  // Progress indicator
  const progressInterval = setInterval(() => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining > 0) {
      process.stdout.write(`\rRunning... ${remaining}s remaining, ${stats.total} requests so far `);
    }
  }, 500);

  await Promise.all(workers);
  clearInterval(progressInterval);

  const actualDuration = (Date.now() - startTime) / 1000;
  const rps = (stats.total / actualDuration).toFixed(2);
  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(2) : 0;
  const avgLatency =
    stats.latencies.length > 0
      ? (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(2)
      : 0;

  console.log('\n\n=== Results ===');
  console.log(`Duration: ${actualDuration.toFixed(2)} seconds`);
  console.log(`Total Requests: ${stats.total.toLocaleString()}`);
  console.log(`Successful: ${stats.success.toLocaleString()}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Success Rate: ${successRate}%`);
  console.log(`Requests/sec: ${rps}`);
  console.log('');
  console.log('Latency (ms):');
  console.log(`  Avg: ${avgLatency} ms`);
  console.log(`  P50: ${percentile(stats.latencies, 0.5)} ms`);
  console.log(`  P95: ${percentile(stats.latencies, 0.95)} ms`);
  console.log(`  P99: ${percentile(stats.latencies, 0.99)} ms`);
  console.log(`  Max: ${Math.max(...stats.latencies)} ms`);
  console.log('');
  console.log('=== Per-Endpoint Stats ===');

  for (const ep of endpoints) {
    const epStats = stats.byEndpoint[ep.path];
    const epTotal = epStats.success + epStats.failed;
    const epRate = epTotal > 0 ? ((epStats.success / epTotal) * 100).toFixed(1) : 0;
    const epAvg =
      epStats.latencies.length > 0
        ? (epStats.latencies.reduce((a, b) => a + b, 0) / epStats.latencies.length).toFixed(1)
        : 0;
    const shortPath = ep.path.length > 45 ? ep.path.substring(0, 42) + '...' : ep.path;
    console.log(
      `  ${shortPath.padEnd(45)} | ${String(epTotal).padStart(6)} reqs | ${String(epRate).padStart(5)}% ok | ${String(epAvg).padStart(5)} ms`
    );
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
