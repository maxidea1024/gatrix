/**
 * Analyze action button patterns in each page to understand what needs to be transformed
 */
const fs = require('fs');
const path = require('path');
const dir = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\pages';
const done = ['GroupsPage', 'OrganisationsPage', 'RolesPage', 'ProjectsPage', 'EnvironmentsPage', 'UsersManagementPage', 'ServiceAccountsPage', 'ApiTokensPage'];

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

            const issues = [];

            // Check Paper variant="outlined"
            if (!c.includes('variant="outlined"')) issues.push('outlined');

            // Check PageContentLoader
            if (!c.includes('PageContentLoader')) issues.push('loader');

            // Check MoreVert
            if (!c.includes('MoreVert')) {
                // Find inline actions in table
                const hasEditIcon = c.includes('EditIcon');
                const hasDeleteIcon = c.includes('DeleteIcon');
                if (hasEditIcon || hasDeleteIcon) {
                    issues.push('morevert');
                }
            }

            // Check TableRow hover
            if (!c.includes('hover>') && !c.includes('hover ')) issues.push('hover');

            if (issues.length > 0) {
                const relPath = fp.replace(dir + '\\', '').replace(/\\/g, '/');
                console.log(`${relPath}: ${issues.join(', ')}`);
            }
        }
    }
}
walk(dir);
