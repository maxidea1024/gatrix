/**
 * Auto-fix remaining hover issues - broader pattern matching
 * Also fix outlined and loader
 */
const fs = require('fs');
const path = require('path');
const dir = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\pages';
const done = ['GroupsPage', 'OrganisationsPage', 'RolesPage', 'ProjectsPage', 'EnvironmentsPage', 'UsersManagementPage', 'ServiceAccountsPage', 'ApiTokensPage'];

let modifiedCount = 0;

function processFile(fp, relPath) {
    let c = fs.readFileSync(fp, 'utf8');
    let modified = false;

    // 1. Add hover to TableRow in TableBody - multiple patterns
    // Pattern A: <TableRow key={...}> (already done above)
    // Pattern B: <TableRow\n  key={...}\n  sx={...}\n> (multiline)
    // We look for TableBody sections and add hover to all TableRows inside that don't have it

    // Simple approach: find all <TableRow that appear after <TableBody and don't have 'hover'
    const lines = c.split('\n');
    let inTableBody = false;
    let tableBodyDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('<TableBody')) {
            inTableBody = true;
            tableBodyDepth = 0;
        }
        if (lines[i].includes('</TableBody')) {
            inTableBody = false;
        }

        if (inTableBody && lines[i].includes('<TableRow') && !lines[i].includes('hover') && !lines[i].includes('</TableRow>')) {
            // Check if this line has the closing >
            if (lines[i].includes('>')) {
                lines[i] = lines[i].replace('<TableRow', '<TableRow hover');
                modified = true;
            } else {
                // Multiline - add hover after <TableRow
                lines[i] = lines[i].replace('<TableRow', '<TableRow hover');
                modified = true;
            }
        }
    }

    if (modified) {
        c = lines.join('\n');
    }

    // 2. Fix Paper variant="outlined" on TableContainer
    if (c.includes('component={Paper}') && !c.includes('variant="outlined"')) {
        c = c.replace(
            /(<TableContainer\s+component=\{Paper\})(\s*>)/g,
            '$1 variant="outlined"$2'
        );
        modified = true;
        console.log(`  ${relPath}: Added Paper variant="outlined"`);
    }

    // Also handle: <TableContainer component={Paper} sx={...}>
    if (c.includes('component={Paper}') && !c.includes('variant="outlined"')) {
        c = c.replace(
            /component=\{Paper\}/g,
            'component={Paper} variant="outlined"'
        );
        modified = true;
        console.log(`  ${relPath}: Added variant="outlined" (pattern 2)`);
    }

    if (modified) {
        fs.writeFileSync(fp, c, 'utf8');
        modifiedCount++;
        console.log(`  ${relPath}: Fixed`);
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

            const relPath = fp.replace(dir + '\\', '').replace(/\\/g, '/');
            processFile(fp, relPath);
        }
    }
}

console.log('Auto-fixing hover and outlined (phase 2)...\n');
walk(dir);
console.log(`\nModified ${modifiedCount} files`);
