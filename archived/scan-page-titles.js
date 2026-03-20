const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'pages');

const pages = [
  'features/FeatureNetworkPage',
  'admin/ClientVersionsPage',
  'admin/GameWorldsPage',
  'admin/MaintenancePage',
  'admin/MessageTemplatesPage',
  'game/HotTimeButtonEventPage',
  'game/LiveEventPage',
  'admin/UsersManagementPage',
  'admin/AuditLogsPage',
  'admin/RealtimeEventsPage',
  'admin/CrashesPage',
  'admin/CrashEventsPage',
  'admin/ApiTokensPage',
  'admin/WhitelistPage',
  'admin/ServerListPage',
  'admin/ServerLifecyclePage',
  'admin/SystemConsolePage',
];

pages.forEach(p => {
  const file = path.join(basePath, p + '.tsx');
  if (!fs.existsSync(file)) {
    console.log(p + ': NOT FOUND\n');
    return;
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  
  // Find the main return ( and show next 15 lines
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*return\s*\(/.test(lines[i])) {
      console.log(p + ' (return at L' + (i+1) + '):');
      for (let j = i; j < Math.min(i + 15, lines.length); j++) {
        console.log('  ' + (j+1) + ': ' + lines[j]);
      }
      console.log('');
      break;
    }
  }
});
