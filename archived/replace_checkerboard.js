const fs = require('fs');
const path =
  'c:/github/admin-templates/gatrix/packages/frontend/src/pages/admin/ServerListPage.tsx';

try {
  let content = fs.readFileSync(path, 'utf8');

  // Find the exact strings to identify the block
  // Note: we need to careful with whitespace/newlines match
  // We'll search for unique substrings at the beginning and end of the block

  const startMarker = "{!isLoading && viewMode === 'checkerboard' && useMemo(() => {";
  const endMarker = '}, [gridDisplayServices, updatedServiceIds, heartbeatIds, groupingBy, t])}';

  const startIndex = content.indexOf(startMarker);

  if (startIndex === -1) {
    console.log('Could not find start marker');
    process.exit(1);
  }

  const endMarkerIndex = content.indexOf(endMarker, startIndex);

  if (endMarkerIndex === -1) {
    console.log('Could not find end marker');
    process.exit(1);
  }

  const endIndex = endMarkerIndex + endMarker.length;

  const replacement = `{!isLoading && viewMode === 'checkerboard' && (
        <CheckerboardView
          services={gridDisplayServices}
          updatedServiceIds={updatedServiceIds}
          heartbeatIds={heartbeatIds}
          groupingBy={groupingBy}
          t={t}
          onContextMenu={handleContextMenu}
        />
      )}`;

  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

  fs.writeFileSync(path, newContent, 'utf8');
  console.log('Successfully replaced checkerboard view logic.');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
