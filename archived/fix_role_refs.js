const fs = require('fs');
const path = require('path');

const fixes = [
  // QueueMonitorPage.tsx - line 244: user.role !== 'admin' access check
  {
    file: 'packages/frontend/src/pages/admin/QueueMonitorPage.tsx',
    find: `if (!user || user.role !== 'admin') {`,
    replace: `if (!user) {`,
  },
  // CustomQueueMonitorPage.tsx - line 112: user?.role === 'admin'
  {
    file: 'packages/frontend/src/pages/admin/CustomQueueMonitorPage.tsx',
    find: `if (user?.role === 'admin') {`,
    replace: `if (user) {`,
  },
  // CustomQueueMonitorPage.tsx - line 210: user.role !== 'admin' access check
  {
    file: 'packages/frontend/src/pages/admin/CustomQueueMonitorPage.tsx',
    find: `if (!user || user.role !== 'admin') {`,
    replace: `if (!user) {`,
  },
  // MentionAutocomplete.tsx - line 157: user.role === 'admin' admin badge
  {
    file: 'packages/frontend/src/components/chat/MentionAutocomplete.tsx',
    find: `                    {user.role === 'admin' && (
                      <Chip
                        label={t('chat.admin')}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 16, fontSize: '0.6rem' }}
                      />
                    )}`,
    replace: ``,
  },
  // UserPresence.tsx - line 175: user.role === 'admin' admin badge
  {
    file: 'packages/frontend/src/components/chat/UserPresence.tsx',
    find: `        {user.role === 'admin' && (
          <Chip
            label={t('chat.admin')}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              height: size === 'small' ? 16 : 20,
              fontSize: size === 'small' ? '0.6rem' : '0.7rem',
            }}
          />
        )}`,
    replace: ``,
  },
  // ChangeRequestDetailDrawer.tsx - line 1148: user?.role === 'admin'
  {
    file: 'packages/frontend/src/components/admin/ChangeRequestDetailDrawer.tsx',
    find: `(cr.requesterId === user?.id || user?.role === 'admin') && (
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),`,
    replace: `(cr.requesterId === user?.id || hasAnyPermissions) && (
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),`,
  },
  // ChangeRequestDetailDrawer.tsx - line 1215: user?.role === 'admin' (conflict status)
  {
    file: 'packages/frontend/src/components/admin/ChangeRequestDetailDrawer.tsx',
    find: `(cr.requesterId === user?.id || user?.role === 'admin') && (
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),`,
    replace: `(cr.requesterId === user?.id || hasAnyPermissions) && (
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),`,
  },
  // AuthContext.tsx - line 179: user.role check
  {
    file: 'packages/frontend/src/contexts/AuthContext.tsx',
    find: `return requiredRoles.includes(user.role);`,
    replace: `return permissions.length > 0;`,
  },
];

let totalChanges = 0;
const basePath = 'c:/work/uwo/gatrix';

for (const fix of fixes) {
  const filePath = path.join(basePath, fix.file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(fix.find)) {
      content = content.replace(fix.find, fix.replace);
      fs.writeFileSync(filePath, content, 'utf8');
      totalChanges++;
      console.log(`✅ Fixed: ${fix.file}`);
    } else {
      console.log(`⚠️ Pattern not found: ${fix.file}`);
      // Show a snippet to debug
      const lines = content.split('\n');
      for (const findLine of fix.find.split('\n').slice(0, 1)) {
        const trimmed = findLine.trim();
        if (trimmed) {
          const lineIdx = lines.findIndex(l => l.includes(trimmed));
          if (lineIdx >= 0) {
            console.log(`   Found partial at line ${lineIdx + 1}: "${lines[lineIdx].trimEnd()}"`);
          }
        }
      }
    }
  } catch (err) {
    console.log(`❌ Error: ${fix.file}: ${err.message}`);
  }
}

// Also need to add hasAnyPermissions to ChangeRequestDetailDrawer
const drawerPath = path.join(basePath, 'packages/frontend/src/components/admin/ChangeRequestDetailDrawer.tsx');
const drawerContent = fs.readFileSync(drawerPath, 'utf8');
if (drawerContent.includes('const { user } = useAuth()')) {
  const newContent = drawerContent.replace(
    'const { user } = useAuth()',
    'const { user, permissions } = useAuth();\n  const hasAnyPermissions = permissions.length > 0'
  );
  fs.writeFileSync(drawerPath, newContent, 'utf8');
  totalChanges++;
  console.log('✅ Added hasAnyPermissions to ChangeRequestDetailDrawer');
} else {
  console.log('⚠️ Could not find useAuth in ChangeRequestDetailDrawer, searching...');
  const lines = drawerContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useAuth')) {
      console.log(`   Line ${i + 1}: "${lines[i].trimEnd()}"`);
    }
  }
}

console.log(`\nTotal changes: ${totalChanges}`);
