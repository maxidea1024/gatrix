const fs = require('fs');
const path = 'c:/github/admin-templates/gatrix/packages/frontend/src/pages/admin/ServerListPage.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Find start of function
    const startMarker = 'const handleBulkHealthCheckStart = async () => {';
    const startIndex = content.indexOf(startMarker);

    if (startIndex === -1) {
        console.error('Function start not found');
        process.exit(1);
    }

    // Find end of function. We look for the closing brace of the function.
    // The function structure is:
    // const handleBulkHealthCheckStart = async () => {
    //   ...
    //   setBulkHealthCheckRunning(false);
    // };

    // So we search for `setBulkHealthCheckRunning(false);` and then the next `};`.
    const endLogicMarker = 'setBulkHealthCheckRunning(false);';
    const endLogicIndex = content.indexOf(endLogicMarker, startIndex);

    if (endLogicIndex === -1) {
        console.error('Function logic end not found');
        process.exit(1);
    }

    const endIndex = content.indexOf('};', endLogicIndex);
    if (endIndex === -1) {
        console.error('Function closing brace not found');
        process.exit(1);
    }

    // Define new function content
    const newFunction = `const handleBulkHealthCheckStart = async () => {
    setBulkHealthCheckRunning(true);

    const selectedKeys = new Set(bulkHealthCheckSelected);

    // Reset selected items to 'pending' status using functional update to ensure fresh state
    setBulkHealthCheckResults(prev => prev.map(item =>
      selectedKeys.has(item.serviceKey)
        ? { ...item, status: 'pending' as const, latency: undefined, error: undefined }
        : item
    ));

    // Create a list of items to check. We use the current state's list as source of truth.
    // Note: 'itemsToCheck' are just metadata objects provided to the loop.
    const itemsToCheck = bulkHealthCheckResults.filter(item => selectedKeys.has(item.serviceKey));

    for (const item of itemsToCheck) {
      // Find current index dynamically for scrolling
      const currentIndex = bulkHealthCheckResults.findIndex(r => r.serviceKey === item.serviceKey);

      // Update status to 'checking'
      setBulkHealthCheckResults(prev => prev.map(r =>
        r.serviceKey === item.serviceKey ? { ...r, status: 'checking' as const } : r
      ));

      // Auto-scroll logic
      if (currentIndex !== -1) {
        setTimeout(() => {
          const row = document.getElementById(\`bulk-health-row-\${currentIndex}\`);
          const container = document.getElementById('bulk-health-check-scroll-container');
          if (row && container) {
            const rowTop = row.offsetTop;
            const containerHeight = container.clientHeight;
            const headerHeight = 40;
            const scrollTarget = rowTop - headerHeight - (containerHeight / 2) + (row.offsetHeight / 2);
            container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
          }
        }, 50);
      }

      try {
        const result = await serviceDiscoveryService.healthCheck(item.service, item.instanceId);

        setBulkHealthCheckResults(prev => prev.map(r =>
          r.serviceKey === item.serviceKey ? {
            ...r,
            status: 'success' as const,
            latency: result.latency,
            error: result.error
          } : r
        ));
      } catch (error: any) {
        setBulkHealthCheckResults(prev => prev.map(r =>
          r.serviceKey === item.serviceKey ? {
            ...r,
            status: 'failed' as const,
            latency: 0,
            error: error.message || 'Request failed'
          } : r
        ));
      }

      // Small delay for UI smoothness
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setBulkHealthCheckRunning(false);
  };`;

    // Improve replacement logic: replace everything from startIndex to endIndex + 2 (length of '};')
    const newContent = content.substring(0, startIndex) + newFunction + content.substring(endIndex + 2);

    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Function replaced successfully');

} catch (err) {
    console.error('Error:', err);
    process.exit(1);
}
