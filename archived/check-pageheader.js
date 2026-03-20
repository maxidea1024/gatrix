/**
 * Validate PageHeader actions prop syntax in all modified files
 */
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'pages');

const files = [
  'admin/ClientVersionsPage.tsx',
  'admin/GameWorldsPage.tsx',
  'admin/MessageTemplatesPage.tsx',
  'admin/AuditLogsPage.tsx',
  'admin/RealtimeEventsPage.tsx',
  'admin/ApiTokensPage.tsx',
  'admin/WhitelistPage.tsx',
  'admin/ServerLifecyclePage.tsx',
  'admin/UsersManagementPage.tsx',
];

files.forEach(f => {
  const fp = path.join(base, f);
  if (!fs.existsSync(fp)) { console.log('NOT FOUND: ' + f); return; }
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split('\n');
  
  // Find PageHeader with actions
  let pageHeaderStart = -1;
  let hasActions = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<PageHeader')) {
      pageHeaderStart = i;
    }
    if (pageHeaderStart >= 0 && lines[i].includes('actions={')) {
      hasActions = true;
    }
    if (pageHeaderStart >= 0 && lines[i].includes('/>') && (lines[i].includes('PageHeader') || lines[i].trim() === '/>')) {
      if (hasActions) {
        // Show the PageHeader block
        console.log('=== ' + f + ' (lines ' + (pageHeaderStart+1) + '-' + (i+1) + ') ===');
        for (let j = pageHeaderStart; j <= i; j++) {
          console.log((j+1) + ': ' + lines[j]);
        }
        console.log('');
      }
      pageHeaderStart = -1;
      hasActions = false;
    }
  }
});
