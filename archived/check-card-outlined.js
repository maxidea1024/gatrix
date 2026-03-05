/**
 * Check for Card wrapping tables without variant="outlined"
 */
const fs = require('fs');
const path = require('path');
const dir = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\pages';

function walk(d) {
    const items = fs.readdirSync(d);
    for (const i of items) {
        const fp = path.join(d, i);
        if (fs.statSync(fp).isDirectory()) {
            walk(fp);
        } else if (i.endsWith('Page.tsx')) {
            const c = fs.readFileSync(fp, 'utf8');
            if (!c.includes('TableBody')) continue;

            // Check if has <Card> without variant="outlined" near table
            const hasCardWithoutOutlined = c.includes('<Card>') && c.includes('TableContainer');
            const hasTableContainerWithoutOutlined = c.includes('<TableContainer>') && !c.includes('variant="outlined"');

            if (hasCardWithoutOutlined || hasTableContainerWithoutOutlined) {
                const relPath = fp.replace(dir + '\\', '').replace(/\\/g, '/');
                const issues = [];
                if (hasCardWithoutOutlined) issues.push('Card missing outlined');
                if (hasTableContainerWithoutOutlined) issues.push('TableContainer missing outlined');
                console.log(`${relPath}: ${issues.join(', ')}`);
            }
        }
    }
}
walk(dir);
