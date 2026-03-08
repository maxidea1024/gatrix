const http = require('http');

// Check what cacheKey the Edge's clientAuth resolves for 'development'
// by looking at the environmentRegistry tree
http.get('http://localhost:3400/internal/environments', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('=== Environment Registry Tree ===');
    try {
      const json = JSON.parse(data);
      const tree = json.data?.tree || json.tree || [];
      for (const org of tree) {
        for (const proj of org.projects || []) {
          for (const env of proj.environments || []) {
            const token = `unsecured-${org.id}:${proj.id}:${env.id}-server-api-token`;
            console.log(`  Env: ${env.name} (${env.id})`);
            console.log(`    Resolved token: ${token}`);
          }
        }
      }
    } catch (e) {
      console.log('Response:', data.substring(0, 500));
    }
  });
});

// Also check token provider tokens via internal cache summary
setTimeout(() => {
  http.get('http://localhost:3400/internal/cache', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('\n=== Cache Status (full) ===');
      try {
        const json = JSON.parse(data);
        // Print ALL keys at every level to find token keys
        const d = json.data || {};
        for (const [section, sectionData] of Object.entries(d)) {
          if (typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData)) {
            const keys = Object.keys(sectionData);
            if (keys.length > 0) {
              console.log(`\n${section} keys:`);
              for (const k of keys) {
                const val = sectionData[k];
                if (typeof val === 'object' && val !== null) {
                  console.log(`  "${k}": ${Object.keys(val).length} items`);
                } else {
                  console.log(`  "${k}": ${JSON.stringify(val)}`);
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
    });
  });
}, 500);
