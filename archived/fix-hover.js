/**
 * Fix duplicate hover: pattern where hover appears twice with other attrs between
 * e.g. <TableRow hover\n  key={...}\n  hover  ->  <TableRow\n  key={...}\n  hover
 */
const fs = require('fs');
const path = require('path');

const files = [
    'pages/admin/ClientVersionsPage.tsx',
    'pages/admin/WhitelistPage.tsx',
    'pages/features/FeatureFlagsPage.tsx',
    'pages/features/ReleaseFlowTemplatesPage.tsx',
    'pages/game/BannerManagementPage.tsx',
    'pages/game/PlanningDataPage.tsx',
    'pages/game/RewardTemplatesPage.tsx',
];

const base = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\';

for (const f of files) {
    const fp = path.join(base, f);
    const lines = fs.readFileSync(fp, 'utf8').split('\n');
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
        // Find <TableRow hover at end of line
        if (lines[i].match(/<TableRow\s+hover\s*$/) || lines[i].match(/<TableRow hover$/)) {
            // Look ahead for another 'hover' within 5 lines
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                if (lines[j].trim() === 'hover' || lines[j].trim().startsWith('hover ') || lines[j].trim().match(/^hover$/)) {
                    // Remove hover from the <TableRow line
                    lines[i] = lines[i].replace(/ hover/, '');
                    modified = true;
                    console.log(`  ${f}:${i + 1}: removed first hover (second at ${j + 1})`);
                    break;
                }
            }
        }
    }

    if (modified) {
        fs.writeFileSync(fp, lines.join('\n'));
    }
}
console.log('Done');
