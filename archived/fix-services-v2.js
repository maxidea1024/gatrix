/**
 * CORRECT transformation for service files:
 * 1. Replace '/admin/XXX' paths with `${projectApiPath}/XXX` template literals
 * 2. Add projectApiPath: string param ONLY to real class async methods (not if/for/while)
 * 
 * Fixes from previous attempt: skip non-method keywords like if, for, while, switch, return
 */
const fs = require('fs');
const path = require('path');

const svcDir = path.join('packages', 'frontend', 'src', 'services');
const NON_METHOD_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'catch', 'throw', 'new', 'const', 'let', 'var', 'typeof', 'await', 'try', 'function']);

// Service files that were restored and need re-transformation
const RESTORE_FILES = {
    'ingamePopupNoticeService.ts': ['/admin/ingame-popup-notices'],
    'serviceNoticeService.ts': ['/admin/service-notices'],
    'apiTokenService.ts': ['/admin/api-tokens'],
    'changeRequestService.ts': ['/admin/change-requests'],
    'environmentService.ts': ['/admin/environments'],
    'tagService.ts': ['/admin/tags'],
    'unknownFlagService.ts': ['/admin/unknown-flags'],
    'planningDataService.ts': ['/admin/planning-data'],
    'maintenanceService.ts': ['/admin/maintenance'],
    'platformDefaultsService.ts': ['/admin/platform-defaults'],
    'clientVersionService.ts': ['/admin/client-versions'],
};

let totalFixes = 0;

for (const [filename, paths] of Object.entries(RESTORE_FILES)) {
    const filePath = path.join(svcDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${filename}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let fixes = 0;

    // Step 1: Replace paths
    for (const adminPath of paths) {
        const resource = adminPath.replace('/admin/', '');
        const escaped = adminPath.replace(/\//g, '\\/');

        // Pattern 1: '/admin/xxx/yyy' -> `${projectApiPath}/xxx/yyy`
        const p1 = new RegExp(`'${escaped}/([^']*)'`, 'g');
        content = content.replace(p1, (m, rest) => { fixes++; return `\`\${projectApiPath}/${resource}/${rest}\``; });

        // Pattern 2: '/admin/xxx' standalone
        const p2 = new RegExp(`'${escaped}'`, 'g');
        content = content.replace(p2, () => { fixes++; return `\`\${projectApiPath}/${resource}\``; });

        // Pattern 3: template literal `/admin/xxx${...}` 
        const p3 = new RegExp(`\`${escaped}`, 'g');
        content = content.replace(p3, () => { fixes++; return `\`\${projectApiPath}/${resource}`; });
    }

    // Step 2: Add projectApiPath param to class methods ONLY
    if (fixes > 0) {
        const lines = content.split('\n');
        const result = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Only match REAL class method signatures:
            // "  async methodName(" or "  methodName("
            // Must start with whitespace + optional async + identifier + (
            // Must NOT be a control flow keyword
            const methodMatch = line.match(/^(\s+)(async\s+)?(\w+)\s*\((.*)$/);

            if (methodMatch && !line.includes('projectApiPath')) {
                const name = methodMatch[3];

                // Skip non-method keywords
                if (NON_METHOD_KEYWORDS.has(name)) {
                    result.push(line);
                    continue;
                }

                // Check if method body uses projectApiPath
                let usesIt = false;
                let braceCount = 0;
                for (let j = i; j < Math.min(i + 50, lines.length); j++) {
                    if (j > i && lines[j].includes('projectApiPath')) { usesIt = true; break; }
                    // Simple: stop at next method
                    if (j > i + 1 && lines[j].match(/^\s+(async\s+)?\w+\s*\(/) && !NON_METHOD_KEYWORDS.has((lines[j].match(/\s+(?:async\s+)?(\w+)/) || [])[1])) break;
                }

                if (usesIt) {
                    const indent = methodMatch[1];
                    const asyncKw = methodMatch[2] || '';
                    const rest = methodMatch[4];

                    if (rest.trim().startsWith(')')) {
                        line = `${indent}${asyncKw}${name}(projectApiPath: string${rest}`;
                    } else {
                        line = `${indent}${asyncKw}${name}(projectApiPath: string, ${rest}`;
                    }
                    fixes++;
                }
            }

            result.push(line);
        }

        content = result.join('\n');
    }

    if (fixes > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${filename}: ${fixes} fixes`);
        totalFixes += fixes;
    } else {
        console.log(`⚠️ ${filename}: no changes`);
    }
}

// Also fix EnvironmentCopyDialog.tsx which was restored
const copyDialogPath = path.join('packages', 'frontend', 'src', 'components', 'EnvironmentCopyDialog.tsx');
// This file was restored, so no changes needed to it directly
// (it imports services that were changed)

console.log(`\nTotal: ${totalFixes} fixes`);

// Verify no /admin/ remains for moved routes
console.log('\nVerification:');
const moved = ['actions', 'signal-endpoints', 'service-accounts', 'planning-data', 'client-versions', 'game-worlds', 'maintenance', 'message-templates', 'service-notices', 'ingame-popup-notices', 'surveys', 'reward-templates', 'store-products', 'banners', 'coupon-settings', 'server-lifecycle', 'vars', 'cms/cash-shop', 'platform-defaults', 'api-tokens', 'change-requests', 'environments', 'tags', 'unknown-flags'];
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
console.log(`Remaining /admin/ references: ${remaining}`);
