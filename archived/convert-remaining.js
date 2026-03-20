// Manual conversion for remaining 5 complex pages
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'pages');

function addPageHeaderImport(content) {
  if (content.includes("import PageHeader from")) return content;
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 200); i++) {
    if (lines[i].startsWith('import ') || lines[i].match(/^}\s*from\s+'/)) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, "import PageHeader from '@/components/common/PageHeader';");
  }
  return lines.join('\n');
}

// 1. EventLensProjectsPage.tsx
{
  const fp = path.join(pagesDir, 'admin', 'EventLensProjectsPage.tsx');
  let content = fs.readFileSync(fp, 'utf8');
  // Replace the header section (lines 33-46)
  const oldHeader = `      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FolderIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('eventLens.projects.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('eventLens.projects.subtitle')}
            </Typography>
          </Box>
        </Box>
      </Box>`;
  const newHeader = `      <PageHeader
        icon={<FolderIcon />}
        title={t('eventLens.projects.title')}
        subtitle={t('eventLens.projects.subtitle')}
      />`;
  content = content.replace(oldHeader, newHeader);
  content = addPageHeaderImport(content);
  fs.writeFileSync(fp, content, 'utf8');
  console.log('CONVERTED: EventLensProjectsPage.tsx');
}

// 2. JobsPage.tsx
{
  const fp = path.join(pagesDir, 'admin', 'JobsPage.tsx');
  let content = fs.readFileSync(fp, 'utf8');
  const oldHeader = `      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WorkIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('jobs.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('jobs.description')}
            </Typography>
          </Box>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddJob}
          >
            {t('jobs.addJob')}
          </Button>
        )}
      </Box>`;
  const newHeader = `      <PageHeader
        icon={<WorkIcon />}
        title={t('jobs.title')}
        subtitle={t('jobs.description')}
        actions={
          canManage ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddJob}
            >
              {t('jobs.addJob')}
            </Button>
          ) : undefined
        }
      />`;
  content = content.replace(oldHeader, newHeader);
  content = addPageHeaderImport(content);
  fs.writeFileSync(fp, content, 'utf8');
  console.log('CONVERTED: JobsPage.tsx');
}

// 3. PlayerConnectionsPage.tsx
{
  const fp = path.join(pagesDir, 'admin', 'PlayerConnectionsPage.tsx');
  let content = fs.readFileSync(fp, 'utf8');
  const oldHeader = `      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PeopleIcon color="primary" />
          <Typography variant="h5" fontWeight="bold">
            {t('playerConnections.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('playerConnections.subtitle')}
        </Typography>
      </Box>`;
  const newHeader = `      <PageHeader
        icon={<PeopleIcon />}
        title={t('playerConnections.title')}
        subtitle={t('playerConnections.subtitle')}
      />`;
  content = content.replace(oldHeader, newHeader);
  content = addPageHeaderImport(content);
  fs.writeFileSync(fp, content, 'utf8');
  console.log('CONVERTED: PlayerConnectionsPage.tsx');
}

// 4. ChangeRequestsPage.tsx - has h4 without icon
{
  const fp = path.join(pagesDir, 'admin', 'ChangeRequestsPage.tsx');
  let content = fs.readFileSync(fp, 'utf8');
  const oldHeader = `      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {t('changeRequest.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('changeRequest.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          {t('common.refresh')}
        </Button>
      </Box>`;
  const newHeader = `      <PageHeader
        icon={<CompareArrowsIcon />}
        title={t('changeRequest.title')}
        subtitle={t('changeRequest.subtitle')}
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            {t('common.refresh')}
          </Button>
        }
      />`;
  content = content.replace(oldHeader, newHeader);
  content = addPageHeaderImport(content);
  // Add CompareArrowsIcon import if not present
  if (!content.includes('CompareArrowsIcon') && !content.includes('CompareArrows')) {
    content = content.replace(
      "} from '@mui/icons-material';",
      "  CompareArrows as CompareArrowsIcon,\n} from '@mui/icons-material';"
    );
  }
  fs.writeFileSync(fp, content, 'utf8');
  console.log('CONVERTED: ChangeRequestsPage.tsx');
}

// 5. GroupsPage.tsx - has h5 without icon, has Group icon imported
{
  const fp = path.join(pagesDir, 'admin', 'GroupsPage.tsx');
  let content = fs.readFileSync(fp, 'utf8');
  const oldHeader = `      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('rbac.groups.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rbac.groups.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          {t('rbac.groups.create')}
        </Button>
      </Box>`;
  const newHeader = `      <PageHeader
        icon={<GroupIcon />}
        title={t('rbac.groups.title')}
        subtitle={t('rbac.groups.description')}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            {t('rbac.groups.create')}
          </Button>
        }
      />`;
  content = content.replace(oldHeader, newHeader);
  content = addPageHeaderImport(content);
  fs.writeFileSync(fp, content, 'utf8');
  console.log('CONVERTED: GroupsPage.tsx');
}

console.log('\nDone!');
