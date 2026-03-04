/**
 * Phase 3: Comprehensive MoreVert transformation script
 * 
 * For each page with inline action buttons:
 * 1. Add Menu, MenuItem, ListItemIcon, ListItemText to MUI imports
 * 2. Add MoreVertIcon to icons imports
 * 3. Find menu state pattern or add new one
 * 4. Find action column with inline IconButtons and replace with MoreVert
 * 5. Add Menu component after table
 * 
 * This script analyses each file and outputs what needs to be done.
 */
const fs = require('fs');
const path = require('path');
const dir = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\pages';
const done = ['GroupsPage', 'OrganisationsPage', 'RolesPage', 'ProjectsPage', 'EnvironmentsPage', 'UsersManagementPage', 'ServiceAccountsPage', 'ApiTokensPage'];

function analyzeActions(fp, name) {
    const c = fs.readFileSync(fp, 'utf8');
    if (!c.includes('MoreVert') && (c.includes('EditIcon') || c.includes('DeleteIcon'))) {
        const lines = c.split('\n');

        // Find action IconButtons in table cells
        const actions = [];
        let inTableBody = false;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('<TableBody')) inTableBody = true;
            if (lines[i].includes('</TableBody')) inTableBody = false;

            if (inTableBody) {
                // Look for Tooltip+IconButton patterns or direct IconButton patterns
                const line = lines[i].trim();
                if (line.includes('EditIcon') || line.includes('DeleteIcon') ||
                    line.includes('FileCopy') || line.includes('PlayArrow') ||
                    line.includes('StopIcon') || line.includes('PauseIcon') ||
                    line.includes('RestoreIcon') || line.includes('RefreshIcon')) {
                    // Check nearby lines for onClick handler
                    for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
                        if (lines[j].includes('onClick')) {
                            const handler = lines[j].match(/onClick=\{[^}]*\}/)?.[0] ||
                                lines[j].match(/onClick=\{.*$/)?.[0];
                            if (handler) {
                                actions.push({ line: i + 1, icon: line.trim(), handler: handler.trim() });
                            }
                            break;
                        }
                    }
                }
            }
        }

        // Check what imports are needed
        const needsMenu = !c.includes("import") || !c.match(/Menu[,\s}]/);
        const needsListItemIcon = !c.includes('ListItemIcon');
        const needsListItemText = !c.includes('ListItemText');
        const needsMoreVert = !c.includes('MoreVert');

        return {
            name,
            path: fp,
            actions,
            imports: { needsMenu, needsListItemIcon, needsListItemText, needsMoreVert },
            hasActionsColumn: c.includes("t('common.actions')") || c.includes('actions')
        };
    }
    return null;
}

function walk(d) {
    const items = fs.readdirSync(d);
    const results = [];
    for (const i of items) {
        const fp = path.join(d, i);
        if (fs.statSync(fp).isDirectory()) {
            results.push(...walk(fp));
        } else if (i.endsWith('Page.tsx')) {
            const name = i.replace('.tsx', '');
            if (done.includes(name)) continue;
            const c = fs.readFileSync(fp, 'utf8');
            if (!(c.includes('TableContainer') || c.includes('TableBody'))) continue;

            const result = analyzeActions(fp, name);
            if (result) results.push(result);
        }
    }
    return results;
}

const results = walk(dir);
console.log(`Found ${results.length} pages needing MoreVert conversion:\n`);
for (const r of results) {
    const relPath = r.path.replace(dir + '\\', '').replace(/\\/g, '/');
    console.log(`${relPath}:`);
    console.log(`  Actions found: ${r.actions.length}`);
    for (const a of r.actions) {
        console.log(`    Line ${a.line}: ${a.icon.substring(0, 60)}`);
    }
    console.log('');
}
