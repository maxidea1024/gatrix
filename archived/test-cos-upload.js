/**
 * Test COS upload via crash event API
 *
 * Usage: node test-cos-upload.js
 */
const http = require('http');

const PORT = process.env.PORT || 45000;
const API_TOKEN = 'unsecured-client-api-token';

const crashData = {
  platform: 'Windows',
  branch: 'develop',
  stack: `NullReferenceException: Object reference not set to an instance of an object
  at GameEngine.Core.PlayerManager.Update () [0x00000] in PlayerManager.cs:42
  at GameEngine.Core.GameLoop.Tick () [0x00000] in GameLoop.cs:128
  at UnityEngine.Internal.InvokeHelper.InvokeMethod () [0x00000]`,
  appVersion: '1.0.0',
  isEditor: false,
  log: `[2026-03-18 10:00:00] INFO: Game started
[2026-03-18 10:00:01] INFO: Loading player data...
[2026-03-18 10:00:02] WARN: Network latency detected (250ms)
[2026-03-18 10:00:03] ERROR: NullReferenceException in PlayerManager.Update
[2026-03-18 10:00:03] ERROR: Stack trace: at GameEngine.Core.PlayerManager.Update()
[2026-03-18 10:00:03] INFO: Crash report generated`,
  userMessage: 'Game crashed while loading player data',
};

const postData = JSON.stringify(crashData);

const options = {
  hostname: '127.0.0.1',
  port: PORT,
  path: '/api/v1/client/crashes',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-application-name': 'test-app',
    'x-api-token': API_TOKEN,
  },
};

console.log(`Sending crash upload to http://127.0.0.1:${PORT}/api/v1/client/crashes`);
console.log(`API Token: ${API_TOKEN}`);
console.log(`Log length: ${crashData.log.length} bytes`);
console.log('---');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      console.log('Response:', JSON.stringify(parsed, null, 2));
    } catch {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
