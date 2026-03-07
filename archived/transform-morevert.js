/**
 * MoreVert Menu Transformation Script
 * 
 * Transforms inline action buttons (Edit/Delete IconButtons in table action columns)
 * into MoreVert dropdown menus, following GroupsPage pattern.
 * 
 * Steps per file:
 * 1. Add Menu, ListItemIcon, ListItemText to MUI imports if missing
 * 2. Add MoreVertIcon to icons imports if missing
 * 3. Add menu state variables after existing state declarations
 * 4. Replace action column content with MoreVert IconButton
 * 5. Add Menu component after the table
 */
const fs = require('fs');
const path = require('path');

const dir = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\pages';
const done = [
    'GroupsPage', 'OrganisationsPage', 'RolesPage', 'ProjectsPage',
    'EnvironmentsPage', 'UsersManagementPage', 'ServiceAccountsPage', 'ApiTokensPage'
];

let totalModified = 0;
let totalSkipped = 0;
const errors = [];

function processFile(fp) {
    const name = path.basename(fp, '.tsx');
    const relPath = fp.replace(dir + '\\', '').replace(/\\/g, '/');
    let c = fs.readFileSync(fp, 'utf8');

    // Skip if already has MoreVert
    if (c.includes('MoreVert')) {
        return;
    }

    // Skip if no inline action buttons
    if (!c.includes('EditIcon') && !c.includes('DeleteIcon')) {
        return;
    }

    console.log(`Processing: ${relPath}`);
    let modified = false;

    // === STEP 1: Add MUI imports ===
    // Find the MUI import block
    const muiImportMatch = c.match(/} from '@mui\/material';/);
    if (muiImportMatch) {
        const insertPos = muiImportMatch.index;
        const beforeImport = c.substring(0, insertPos);

        const additions = [];
        if (!c.includes('Menu,') && !c.includes('Menu\n')) additions.push('  Menu,');
        if (!c.includes('ListItemIcon')) additions.push('  ListItemIcon,');
        if (!c.includes('ListItemText')) additions.push('  ListItemText,');

        if (additions.length > 0) {
            c = beforeImport + additions.join('\n') + '\n' + c.substring(insertPos);
            modified = true;
        }
    }

    // === STEP 2: Add MoreVertIcon import ===
    if (!c.includes('MoreVert')) {
        // Find the icons import block - look for } from '@mui/icons-material'
        const iconsImportMatch = c.match(/} from '@mui\/icons-material';/);
        if (iconsImportMatch) {
            const insertPos = iconsImportMatch.index;
            c = c.substring(0, insertPos) + '  MoreVert as MoreVertIcon,\n' + c.substring(insertPos);
            modified = true;
        }
    }

    // === STEP 3: Find the main component function and add menu state ===
    // Look for useState patterns to find where to add menu state
    // Find the last useState line
    const lines = c.split('\n');
    let lastUseStateLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('useState') && !lines[i].includes('//')) {
            lastUseStateLine = i;
        }
    }

    if (lastUseStateLine > 0 && !c.includes('menuAnchorEl')) {
        // Determine what type to use for menu target based on the data type
        // Look for the map variable in TableBody
        let dataType = 'any';
        for (let i = 0; i < lines.length; i++) {
            const mapMatch = lines[i].match(/\.map\(\((\w+)\)/);
            if (mapMatch && lines[i - 1]?.includes('<TableBody') || lines[i]?.includes('.map(')) {
                // Find the array being mapped
                const arrMatch = lines[i].match(/\{(\w+)\.map/);
                if (arrMatch) {
                    // Look for the state declaration of this array
                    for (let j = 0; j < lines.length; j++) {
                        const stateMatch = lines[j].match(new RegExp(`\\[${arrMatch[1]},.*useState<([^>]+)\\[\\]>`));
                        if (stateMatch) {
                            dataType = stateMatch[1];
                            break;
                        }
                    }
                }
                break;
            }
        }

        const menuState = `
  // Menu state for MoreVert
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<${dataType} | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, item: ${dataType}) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(item);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };`;

        lines.splice(lastUseStateLine + 1, 0, menuState);
        c = lines.join('\n');
        modified = true;
    }

    // === STEP 4: Replace action column buttons with MoreVert ===
    // This is the trickiest part - we need to find the Tooltip/IconButton pattern
    // in the actions column and replace it

    // Find action cells in TableBody - look for the pattern:
    // <TableCell align="center"> or <TableCell> followed by Tooltip+IconButton with Edit/Delete
    // We'll look for the last TableCell in each row that contains action buttons

    const bodyLines = c.split('\n');
    let inTableBody = false;
    let actionCellStart = -1;
    let actionCellEnd = -1;
    let actionCells = [];
    let depth = 0;

    for (let i = 0; i < bodyLines.length; i++) {
        if (bodyLines[i].includes('<TableBody')) inTableBody = true;
        if (bodyLines[i].includes('</TableBody')) inTableBody = false;

        if (inTableBody) {
            // Find action cells - they typically contain EditIcon or DeleteIcon
            if (bodyLines[i].includes('<TableCell') && !bodyLines[i].includes('</TableCell>')) {
                // Look ahead to see if this cell contains action icons
                let hasActionIcon = false;
                let cellEnd = -1;
                let tempDepth = 1;
                for (let j = i + 1; j < Math.min(i + 40, bodyLines.length); j++) {
                    if (bodyLines[j].includes('<TableCell')) tempDepth++;
                    if (bodyLines[j].includes('</TableCell>')) {
                        tempDepth--;
                        if (tempDepth === 0) {
                            cellEnd = j;
                            break;
                        }
                    }
                    if (bodyLines[j].includes('EditIcon') || bodyLines[j].includes('DeleteIcon')) {
                        hasActionIcon = true;
                    }
                }

                if (hasActionIcon && cellEnd > 0) {
                    actionCells.push({ start: i, end: cellEnd });
                }
            }
        }
    }

    // Replace action cells with MoreVert (process in reverse to maintain line numbers)
    if (actionCells.length > 0) {
        // Find the map variable name
        let mapVarName = 'item';
        for (let i = 0; i < bodyLines.length; i++) {
            const mapMatch = bodyLines[i].match(/\.map\(\((\w+)/);
            if (mapMatch) {
                mapVarName = mapMatch[1];
                break;
            }
        }

        // Get indentation from the first action cell
        const indent = bodyLines[actionCells[0].start].match(/^(\s*)/)?.[1] || '                    ';

        for (let idx = actionCells.length - 1; idx >= 0; idx--) {
            const cell = actionCells[idx];

            // Extract action handlers from the cell content
            const cellContent = bodyLines.slice(cell.start, cell.end + 1).join('\n');

            // Build replacement
            const replacement = `${indent}<TableCell align="center">
${indent}  <IconButton size="small" onClick={(e) => handleMenuOpen(e, ${mapVarName})}>
${indent}    <MoreVertIcon fontSize="small" />
${indent}  </IconButton>
${indent}</TableCell>`;

            bodyLines.splice(cell.start, cell.end - cell.start + 1, replacement);
        }

        c = bodyLines.join('\n');
        modified = true;

        // === STEP 5: Add Menu component after TableContainer ===
        // Find </TableContainer> and add menu after it

        // Extract action handlers info from original content
        const origContent = fs.readFileSync(fp, 'utf8');
        const actionHandlers = [];

        // Find Edit handler
        const editMatch = origContent.match(/onClick=\{[^}]*?(?:handleEdit|openEdit|onEdit|handleOpenEdit)[^}]*?\}/);
        if (editMatch) {
            actionHandlers.push({
                label: "t('common.edit')",
                icon: 'EditIcon',
                handler: editMatch[0].replace('onClick={', '').replace('}', ''),
            });
        } else {
            // Try arrow function pattern
            const editArrow = origContent.match(/onClick=\{\(\)\s*=>\s*(?:handleEdit|openEdit|setEdit|handleOpenEdit)\w*\([^)]*\)\s*\}/);
            if (editArrow) {
                actionHandlers.push({
                    label: "t('common.edit')",
                    icon: 'EditIcon',
                    handler: editArrow[0].replace('onClick={', '').replace(/\}$/, ''),
                });
            }
        }

        // Find Delete handler  
        const deleteMatch = origContent.match(/onClick=\{[^}]*?(?:handleDelete|openDelete|onDelete|handleOpenDelete|confirmDelete)[^}]*?\}/);
        if (deleteMatch) {
            actionHandlers.push({
                label: "t('common.delete')",
                icon: 'DeleteIcon',
                iconColor: ' color="error"',
                handler: deleteMatch[0].replace('onClick={', '').replace('}', ''),
            });
        } else {
            const deleteArrow = origContent.match(/onClick=\{\(\)\s*=>\s*(?:handleDelete|openDelete|setDelete|handleOpenDelete|confirmDelete)\w*\([^)]*\)\s*\}/);
            if (deleteArrow) {
                actionHandlers.push({
                    label: "t('common.delete')",
                    icon: 'DeleteIcon',
                    iconColor: ' color="error"',
                    handler: deleteArrow[0].replace('onClick={', '').replace(/\}$/, ''),
                });
            }
        }

        // Build menu items using menuTarget
        let menuItems = '';
        if (actionHandlers.length > 0) {
            for (const ah of actionHandlers) {
                const handler = ah.handler
                    .replace(new RegExp(`\\b${mapVarName}\\b`, 'g'), 'menuTarget')
                    .replace(new RegExp(`\\b${mapVarName}\\.`, 'g'), 'menuTarget?.');

                menuItems += `
        <MenuItem
          onClick={() => {
            if (menuTarget) { ${handler.replace(/^\(\)\s*=>\s*/, '')}; }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <${ah.icon} fontSize="small"${ah.iconColor || ''} />
          </ListItemIcon>
          <ListItemText>{${ah.label}}</ListItemText>
        </MenuItem>`;
            }
        }

        if (menuItems) {
            // Find the closing of table section and add menu
            const menuComponent = `

      {/* Action Menu */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>${menuItems}
      </Menu>`;

            // Insert after </TableContainer> or after PageContentLoader closing
            const tableCloseIdx = c.lastIndexOf('</TableContainer>');
            if (tableCloseIdx > 0) {
                // Find the end of the line
                const lineEnd = c.indexOf('\n', tableCloseIdx);
                // Look for </PageContentLoader> nearby
                const nextLines = c.substring(lineEnd, lineEnd + 200);
                const loaderClose = nextLines.indexOf('</PageContentLoader>');
                if (loaderClose > 0 && loaderClose < 100) {
                    const insertPoint = lineEnd + loaderClose + '</PageContentLoader>'.length;
                    c = c.substring(0, insertPoint) + menuComponent + c.substring(insertPoint);
                } else {
                    c = c.substring(0, lineEnd) + menuComponent + c.substring(lineEnd);
                }
            }
        }
    }

    if (modified) {
        fs.writeFileSync(fp, c, 'utf8');
        totalModified++;
        console.log(`  ✓ Modified`);
    } else {
        totalSkipped++;
        console.log(`  - Skipped (no changes needed or too complex)`);
    }
}

function walk(d) {
    const items = fs.readdirSync(d);
    for (const i of items) {
        const fp = path.join(d, i);
        if (fs.statSync(fp).isDirectory()) {
            walk(fp);
        } else if (i.endsWith('Page.tsx')) {
            const name = i.replace('.tsx', '');
            if (done.includes(name)) continue;
            const c = fs.readFileSync(fp, 'utf8');
            if (!(c.includes('TableContainer') || c.includes('TableBody'))) continue;
            if (c.includes('MoreVert')) continue; // Already done
            if (!c.includes('EditIcon') && !c.includes('DeleteIcon')) continue; // No action buttons

            try {
                processFile(fp);
            } catch (err) {
                errors.push({ file: fp, error: err.message });
                console.log(`  ✗ Error: ${err.message}`);
            }
        }
    }
}

console.log('=== MoreVert Menu Transformation ===\n');
walk(dir);
console.log(`\nResults: ${totalModified} modified, ${totalSkipped} skipped`);
if (errors.length > 0) {
    console.log(`\nErrors:`);
    for (const e of errors) {
        console.log(`  ${e.file}: ${e.error}`);
    }
}
