const http = require('http');

// Call Edge's /internal/cache which should show all cache keys including featureFlags
// The issue: featureFlags showed empty - let's see the entire raw response
http.get('http://localhost:3400/internal/cache', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    // Print the complete response structure
    console.log('=== Full response keys ===');
    console.log('Top level:', Object.keys(json));
    console.log('Data keys:', Object.keys(json.data || {}));
    
    // Print featureFlags raw
    console.log('\n=== featureFlags section (raw) ===');
    console.log(JSON.stringify(json.data?.featureFlags, null, 2));
    
    // Print summary
    console.log('\n=== summary section ===');
    console.log(JSON.stringify(json.data?.summary, null, 2));
    
    // Check clientVersions for comparison (should have data)
    const cv = json.data?.clientVersions;
    if (cv && typeof cv === 'object') {
      console.log('\n=== clientVersions keys ===');
      console.log(Object.keys(cv));
    }
  });
});
