/**
 * Add export/import MoreVert menus to pages that don't have them yet
 */
const fs = require('fs');
const path = require('path');

const PAGES = [
  {
    file: path.join(__dirname, '..', 'packages/frontend/src/pages/admin/MessageTemplatesPage.tsx'),
    dataVar: 'templates',
    filenamePrefix: 'message-templates',
    importUtilsRelPath: '../../utils/exportImportUtils',
    importCompRelPath: '../../components/common/ExportImportMenuItems',
    importDialogRelPath: '../../components/common/ImportDialog',
    exportColumns: [
      { key: 'name', headerKey: 'common.name' },
      { key: 'category', headerKey: 'messageTemplates.category' },
      { key: 'subject', headerKey: 'messageTemplates.subject' },
      { key: 'createdAt', headerKey: 'common.createdAt' },
    ],
    exportOnly: false,
  },
  {
    file: path.join(__dirname, '..', 'packages/frontend/src/pages/admin/ClientVersionsPage.tsx'),
    dataVar: 'versions',
    filenamePrefix: 'client-versions',
    importUtilsRelPath: '../../utils/exportImportUtils',
    importCompRelPath: '../../components/common/ExportImportMenuItems',
    importDialogRelPath: '../../components/common/ImportDialog',
    exportColumns: [
      { key: 'platform', headerKey: 'common.platform' },
      { key: 'version', headerKey: 'clientVersions.version' },
      { key: 'minVersion', headerKey: 'clientVersions.minVersion' },
      { key: 'isActive', headerKey: 'common.status' },
      { key: 'createdAt', headerKey: 'common.createdAt' },
    ],
    exportOnly: false,
  },
  {
    file: path.join(__dirname, '..', 'packages/frontend/src/pages/game/StoreProductsPage.tsx'),
    dataVar: 'products',
    filenamePrefix: 'store-products',
    importUtilsRelPath: '../../utils/exportImportUtils',
    importCompRelPath: '../../components/common/ExportImportMenuItems',
    importDialogRelPath: '../../components/common/ImportDialog',
    exportColumns: [
      { key: 'name', headerKey: 'common.name' },
      { key: 'productId', headerKey: 'storeProducts.productId' },
      { key: 'price', headerKey: 'storeProducts.price' },
      { key: 'isActive', headerKey: 'common.status' },
      { key: 'createdAt', headerKey: 'common.createdAt' },
    ],
    exportOnly: true,
  },
  {
    file: path.join(__dirname, '..', 'packages/frontend/src/pages/game/RewardTemplatesPage.tsx'),
    dataVar: 'templates',
    filenamePrefix: 'reward-templates',
    importUtilsRelPath: '../../utils/exportImportUtils',
    importCompRelPath: '../../components/common/ExportImportMenuItems',
    importDialogRelPath: '../../components/common/ImportDialog',
    exportColumns: [
      { key: 'name', headerKey: 'common.name' },
      { key: 'description', headerKey: 'common.description' },
      { key: 'createdAt', headerKey: 'common.createdAt' },
    ],
    exportOnly: false,
  },
  {
    file: path.join(__dirname, '..', 'packages/frontend/src/pages/game/BannerManagementPage.tsx'),
    dataVar: 'banners',
    filenamePrefix: 'banners',
    importUtilsRelPath: '../../utils/exportImportUtils',
    importCompRelPath: '../../components/common/ExportImportMenuItems',
    importDialogRelPath: '../../components/common/ImportDialog',
    exportColumns: [
      { key: 'title', headerKey: 'banners.title' },
      { key: 'isActive', headerKey: 'common.status' },
      { key: 'createdAt', headerKey: 'common.createdAt' },
    ],
    exportOnly: false,
    jsonOnly: true,
  },
];

function processPage(config) {
  const basename = path.basename(config.file);
  console.log(`Processing: ${basename}`);

  if (!fs.existsSync(config.file)) {
    console.log(`  SKIPPED - File not found: ${config.file}`);
    return;
  }

  let content = fs.readFileSync(config.file, 'utf8');

  // Check if already done
  if (content.includes('ExportImportMenuItems')) {
    console.log(`  SKIPPED - Already has ExportImportMenuItems`);
    return;
  }

  const lines = content.split('\n');

  // 1. Find and add imports
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('} from ') || line.match(/^\}\s+from\s+'/)) {
      lastImportLine = i;
    }
    // Stop after hitting component function declaration
    if (line.match(/^(const|function)\s+\w+(Page|Tab)/) && i > 10) {
      break;
    }
  }

  if (lastImportLine === -1) {
    console.log(`  ERROR: Could not find last import line`);
    return;
  }

  const importLines = [
    `import { exportToFile, ExportColumn } from '${config.importUtilsRelPath}';`,
    `import ExportImportMenuItems from '${config.importCompRelPath}';`,
  ];
  if (!config.exportOnly) {
    importLines.push(`import ImportDialog from '${config.importDialogRelPath}';`);
  }

  // Check imports needed: Menu, MenuItem, ListItemIcon, ListItemText, IconButton, Divider, MoreVertIcon
  const needsImports = {
    Menu: !content.includes("Menu,") && !content.includes("Menu }") && !content.includes("Menu\n"),
    MenuItem: !content.includes("MenuItem"),
    ListItemIcon: !content.includes("ListItemIcon"),
    ListItemText: !content.includes("ListItemText"),
    Divider: !content.includes("Divider"),
    MoreVertIcon: !content.includes("MoreVert"),
  };

  // Add MUI imports if needed
  if (needsImports.MoreVertIcon) {
    // Find the @mui/icons-material import block
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('@mui/icons-material')) {
        // Find the closing of this import
        for (let j = i; j < lines.length; j++) {
          if (lines[j].includes("} from '@mui/icons-material'") || lines[j].includes("} from \"@mui/icons-material\"")) {
            lines[j] = `  MoreVert as MoreVertIcon,\n` + lines[j];
            break;
          }
        }
        break;
      }
    }
  }

  // Re-find last import line since we may have added lines
  content = lines.join('\n');
  const lines2 = content.split('\n');
  lastImportLine = -1;
  for (let i = 0; i < lines2.length; i++) {
    const line = lines2[i].trim();
    if (line.startsWith('import ') || line.startsWith('} from ') || line.match(/^\}\s+from\s+'/)) {
      lastImportLine = i;
    }
    if (line.match(/^(const|function)\s+\w+(Page|Tab)/) && i > 10) {
      break;
    }
  }

  // Insert our imports after the last import
  lines2.splice(lastImportLine + 1, 0, ...importLines);

  content = lines2.join('\n');

  // 2. Add state variables - find first useState block
  const stateInsertPattern = /const\s+\[loading,\s*setLoading\]\s*=\s*useState/;
  const stateMatch = content.match(stateInsertPattern);
  if (stateMatch) {
    const stateInsertIdx = content.indexOf(stateMatch[0]);
    const nextLine = content.indexOf('\n', stateInsertIdx);
    const stateToInsert = config.exportOnly
      ? `\n  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(null);`
      : `\n  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(null);\n  const [importDialogOpen, setImportDialogOpen] = useState(false);`;
    content = content.slice(0, nextLine) + stateToInsert + content.slice(nextLine);
  } else {
    console.log(`  WARNING: Could not find loading state, trying alternative pattern`);
    // Try a different pattern
    const altPattern = /const\s+\[page,\s*setPage\]\s*=\s*useState/;
    const altMatch = content.match(altPattern);
    if (altMatch) {
      const idx = content.indexOf(altMatch[0]);
      const nextLine = content.indexOf('\n', idx);
      const stateToInsert = config.exportOnly
        ? `\n  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(null);`
        : `\n  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(null);\n  const [importDialogOpen, setImportDialogOpen] = useState(false);`;
      content = content.slice(0, nextLine) + stateToInsert + content.slice(nextLine);
    } else {
      console.log(`  ERROR: Could not find state insertion point`);
    }
  }

  // 3. Find the header Add button and add MoreVert after it
  // Pattern: Look for the closing </Button> near the add button followed by whitespace and closing of button group
  // We need to add MoreVert icon + Menu after the Add button but before </Box>
  const addButtonClosePattern = /(\s+\)\}\s*\n)(\s+<\/Box>\s*\n\s+<\/Box>)/;
  const headerMatch = content.match(addButtonClosePattern);

  if (headerMatch) {
    const columnsStr = config.exportColumns
      .map(c => `                  { key: '${c.key}', header: t('${c.headerKey}') },`)
      .join('\n');

    const moreVertMenu = `${headerMatch[1]}          <IconButton onClick={(e) => setPageMenuAnchor(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={pageMenuAnchor}
            open={Boolean(pageMenuAnchor)}
            onClose={() => setPageMenuAnchor(null)}
          >
            <ExportImportMenuItems
              onExport={(format) => {
                setPageMenuAnchor(null);
                const exportColumns: ExportColumn[] = [
${columnsStr}
                ];
                try {
                  exportToFile(${config.dataVar}, exportColumns, '${config.filenamePrefix}', format);
                  enqueueSnackbar(t('common.exportSuccess'), { variant: 'success' });
                } catch (err) {
                  enqueueSnackbar(t('common.exportFailed'), { variant: 'error' });
                }
              }}${config.exportOnly ? '' : `
              onImportClick={() => {
                setPageMenuAnchor(null);
                setImportDialogOpen(true);
              }}`}${config.jsonOnly ? `
              jsonOnly={true}` : ''}${config.exportOnly ? `
              exportOnly={true}` : ''}
            />
          </Menu>
`;
    content = content.replace(addButtonClosePattern, moreVertMenu + headerMatch[2]);
  } else {
    console.log(`  WARNING: Could not find header button area pattern`);
  }

  // 4. Add ImportDialog if not export-only
  if (!config.exportOnly) {
    // Find the last </Box> before the return's closing
    const lastBoxIdx = content.lastIndexOf('    </Box>\n  );\n};');
    if (lastBoxIdx !== -1) {
      const importDialogJSX = `\n      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title={t('common.import')}${config.jsonOnly ? `
        jsonOnly={true}` : ''}
        onImport={async (data) => {
          enqueueSnackbar(t('common.importSuccess'), { variant: 'success' });
        }}
      />
`;
      content = content.slice(0, lastBoxIdx) + importDialogJSX + content.slice(lastBoxIdx);
    } else {
      console.log(`  WARNING: Could not find ImportDialog insertion point`);
    }
  }

  fs.writeFileSync(config.file, content, 'utf8');
  console.log(`  DONE: ${basename}`);
}

PAGES.forEach(processPage);
console.log('\nAll pages processed.');
