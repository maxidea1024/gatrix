/**
 * Fix Card wrapping tables to have variant="outlined"
 * Only replaces <Card> that is followed by <CardContent sx={{ p: 0 (table wrapper pattern)
 */
const fs = require('fs');
const path = require('path');
const dir = 'c:\\work\\uwo\\gatrix\\packages\\frontend\\src\\pages';

const files = [
    'admin/ChangeRequestsPage.tsx',
    'admin/CrashEventsPage.tsx',
    'admin/CustomQueueMonitorPage.tsx',
    'admin/WhitelistPage.tsx',
    'features/FeatureContextFieldsPage.tsx',
    'features/FeatureFlagsPage.tsx',
    'features/FeatureSegmentsPage.tsx',
    'features/ReleaseFlowTemplatesPage.tsx',
    'features/UnknownFlagsPage.tsx',
    'game/CouponSettingsPage.tsx',
    'game/CouponUsagePage.tsx',
    'game/PlanningDataHistoryPage.tsx',
    'game/PlanningDataPage.tsx',
    'game/RewardTemplatesPage.tsx',
    'game/StoreProductsPage.tsx',
    'settings/EditIntegrationPage.tsx',
    'settings/KeyValuePage.tsx',
    'settings/TagsPage.tsx',
];

let changed = 0;
for (const f of files) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) {
        console.log(`SKIP (not found): ${f}`);
        continue;
    }
    let content = fs.readFileSync(fp, 'utf8');

    // Only replace <Card> that's followed by CardContent with p:0 (table pattern)
    const pattern = /<Card>\s*\n\s*<CardContent sx=\{\{ p: 0/g;
    if (pattern.test(content)) {
        content = content.replace(/<Card>\s*\n(\s*<CardContent sx=\{\{ p: 0)/g, '<Card variant="outlined">\n$1');
        fs.writeFileSync(fp, content, 'utf8');
        console.log(`FIXED: ${f}`);
        changed++;
    } else {
        // Try simple pattern - just <Card> before TableContainer
        const simpleCount = (content.match(/<Card>/g) || []).length;
        if (simpleCount > 0 && content.includes('TableContainer')) {
            console.log(`MANUAL: ${f} (has ${simpleCount} <Card> instances, needs manual check)`);
        } else {
            console.log(`SKIP (no matching pattern): ${f}`);
        }
    }
}
console.log(`\nChanged ${changed} files`);
