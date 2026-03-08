const http = require('http');

http.get('http://localhost:3400/internal/cache', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const ff = json.data?.featureFlags;
    console.log('=== featureFlags keys ===');
    console.log(Object.keys(ff || {}));
    for (const [key, flags] of Object.entries(ff || {})) {
      console.log(`\nCache Key: ${key}`);
      for (const [flagName, flagData] of Object.entries(flags || {})) {
        console.log(`  Flag: ${flagName}, isEnabled: ${flagData.isEnabled}, version: ${flagData.version}`);
      }
    }
  });
});
