const fs = require('fs');
const c = fs.readFileSync('packages/frontend/src/pages/features/FeatureFlagsPage.tsx', 'utf8');
const ls = c.split('\n');
ls.forEach((l, i) => {
  if (l.includes('setCreateDialogOpen(true)') || l.includes('handleOpenCreate') || (l.includes('generateFlagName') || l.includes('generateName')))
    console.log((i + 1) + ': ' + l.trim());
});
