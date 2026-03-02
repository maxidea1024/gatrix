/**
 * Fix ALL remaining /admin/ references in service files that should be project-scoped.
 * Handles both single-quoted and template literal patterns.
 */
const fs = require('fs');
const path = require('path');

const svcDir = path.join('packages', 'frontend', 'src', 'services');

// Map of file -> admin paths to replace
const FIXES = {
    'couponService.ts': ['/admin/coupon-settings'],
    'gameWorldService.ts': ['/admin/game-worlds'],
    'ingamePopupNoticeService.ts': ['/admin/ingame-popup-notices'],
    'messageTemplateService.ts': ['/admin/message-templates'],
    'planningDataService.ts': ['/admin/planning-data'],
    'platformDefaultsService.ts': ['/admin/platform-defaults'],
    'serviceNoticeService.ts': ['/admin/service-notices'],
    'storeProductService.ts': ['/admin/store-products', '/admin/cms/cash-shop'],
    'surveyService.ts': ['/admin/surveys'],
    'varsService.ts': ['/admin/vars'],
};

let totalFixed = 0;

for (const [filename, paths] of Object.entries(FIXES)) {
    const filePath = path.join(svcDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${filename} not found`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let fileFixed = 0;

    for (const adminPath of paths) {
        const resource = adminPath.replace('/admin/', '');
        const escaped = adminPath.replace(/\//g, '\\/');

        // Pattern 1: '/admin/xxx/yyy' -> `${projectApiPath}/xxx/yyy`
        // (single-quoted with additional path after)
        const p1 = new RegExp(`'${escaped}/([^']*)'`, 'g');
        content = content.replace(p1, (match, rest) => {
            fileFixed++;
            return `\`\${projectApiPath}/${resource}/${rest}\``;
        });

        // Pattern 2: '/admin/xxx' -> `${projectApiPath}/xxx`
        // (standalone, no trailing path)
        const p2 = new RegExp(`'${escaped}'`, 'g');
        content = content.replace(p2, (match) => {
            fileFixed++;
            return `\`\${projectApiPath}/${resource}\``;
        });

        // Pattern 3: `/admin/xxx${...}` -> `${projectApiPath}/xxx${...}`
        // (template literal with interpolation)
        const p3 = new RegExp(`\`${escaped}`, 'g');
        content = content.replace(p3, (match) => {
            fileFixed++;
            return `\`\${projectApiPath}/${resource}`;
        });
    }

    if (fileFixed > 0) {
        // Also add projectApiPath param to methods that now use it but don't have it
        const lines = content.split('\n');
        const result = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            const methodMatch = line.match(/^(\s+)(async\s+)(\w+)\s*\((.*)$/);
            if (methodMatch && !line.includes('projectApiPath')) {
                let usesIt = false;
                for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
                    if (lines[j].includes('projectApiPath')) { usesIt = true; break; }
                    if (j > i + 1 && lines[j].match(/^\s+(async\s+)?\w+\s*\(/)) break;
                }

                if (usesIt) {
                    const indent = methodMatch[1];
                    const asyncKw = methodMatch[2];
                    const name = methodMatch[3];
                    const rest = methodMatch[4];

                    if (rest.startsWith(')')) {
                        line = `${indent}${asyncKw}${name}(projectApiPath: string${rest}`;
                    } else {
                        line = `${indent}${asyncKw}${name}(projectApiPath: string, ${rest}`;
                    }
                }
            }
            result.push(line);
        }
        content = result.join('\n');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${filename}: ${fileFixed} fixes`);
        totalFixed += fileFixed;
    } else {
        console.log(`⚠️ ${filename}: no fixes needed`);
    }
}

// Verify
console.log(`\nTotal fixed: ${totalFixed}`);
console.log('\nVerification:');
const moved = ['actions', 'signal-endpoints', 'service-accounts', 'planning-data', 'client-versions', 'game-worlds', 'maintenance', 'message-templates', 'service-notices', 'ingame-popup-notices', 'surveys', 'reward-templates', 'store-products', 'banners', 'coupon-settings', 'server-lifecycle', 'vars', 'cms/cash-shop', 'platform-defaults'];
const files = fs.readdirSync(svcDir).filter(f => f.endsWith('.ts'));
let remaining = 0;
for (const f of files) {
    const c = fs.readFileSync(path.join(svcDir, f), 'utf8');
    for (const r of moved) {
        const flat = '/admin/' + r;
        if (c.includes(flat)) {
            const count = (c.match(new RegExp(flat.replace(/\//g, '\\/'), 'g')) || []).length;
            console.log(`  ${f}: ${count} x ${flat}`);
            remaining += count;
        }
    }
}
console.log(`Remaining: ${remaining}`);
