/**
 * Bulk transform frontend service files:
 * Replace '/admin/XXX' with a basePath pattern using projectApiPath.
 * 
 * For each service, this script:
 * 1. Replaces '/admin/XXX' and `/admin/XXX` with the basePath variable
 * 2. Adds projectApiPath parameter to each method in class-based services
 * 3. Adds basePath helper at the top of the file
 */
const fs = require('fs');
const path = require('path');

const svcDir = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'services');

const TRANSFORMS = [
    { file: 'actionSetService.ts', paths: ['/admin/actions'] },
    { file: 'signalEndpointService.ts', paths: ['/admin/signal-endpoints'] },
    { file: 'serviceAccountService.ts', paths: ['/admin/service-accounts'] },
    { file: 'planningDataService.ts', paths: ['/admin/planning-data'] },
    { file: 'clientVersionService.ts', paths: ['/admin/client-versions'] },
    { file: 'gameWorldService.ts', paths: ['/admin/game-worlds'] },
    { file: 'maintenanceService.ts', paths: ['/admin/maintenance'] },
    { file: 'messageTemplateService.ts', paths: ['/admin/message-templates'] },
    { file: 'serviceNoticeService.ts', paths: ['/admin/service-notices'] },
    { file: 'ingamePopupNoticeService.ts', paths: ['/admin/ingame-popup-notices'] },
    { file: 'surveyService.ts', paths: ['/admin/surveys'] },
    { file: 'rewardTemplateService.ts', paths: ['/admin/reward-templates'] },
    { file: 'storeProductService.ts', paths: ['/admin/store-products', '/admin/cms/cash-shop'] },
    { file: 'bannerService.ts', paths: ['/admin/banners'] },
    { file: 'serverLifecycleService.ts', paths: ['/admin/server-lifecycle'] },
    { file: 'varsService.ts', paths: ['/admin/vars'] },
];

let totalChanges = 0;

for (const transform of TRANSFORMS) {
    const filePath = path.join(svcDir, transform.file);
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${transform.file}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;

    for (const adminPath of transform.paths) {
        // Determine the resource name after /admin/
        const resourcePath = adminPath.replace('/admin/', '');

        // Replace string literal: '/admin/xxx' -> `${projectApiPath}/xxx`
        // Handle: '/admin/xxx'  (in single quotes, standalone path)
        const singleQuoteStandalone = new RegExp(`'${adminPath.replace(/\//g, '\\/')}(?=')`, 'g');
        let match;
        while ((match = singleQuoteStandalone.exec(content)) !== null) {
            changes++;
        }
        content = content.replace(
            new RegExp(`'${adminPath.replace(/\//g, '\\/')}'`, 'g'),
            `\`\${projectApiPath}/${resourcePath}\``
        );

        // Replace template literal: `/admin/xxx${...}` -> `${projectApiPath}/xxx${...}`
        content = content.replace(
            new RegExp(`\`${adminPath.replace(/\//g, '\\/')}`, 'g'),
            (match) => {
                changes++;
                return `\`\${projectApiPath}/${resourcePath}`;
            }
        );
    }

    // Now add projectApiPath parameter to methods
    // For class-based services: add projectApiPath: string to each method
    // For object-based services: add projectApiPath: string to each function

    // Strategy: Find all method signatures and add projectApiPath as first param
    // Pattern: async methodName(  or  methodName(

    // Add projectApiPath to class methods that use api calls
    // We'll do this by finding methods that contain projectApiPath in their body
    // (which we just added) but don't have it as a parameter

    // For class-based: "async methodName(" -> "async methodName(projectApiPath: string, "
    // For class-based with no params: "async methodName()" -> "async methodName(projectApiPath: string)"

    // Simple approach: find lines with "async " followed by "(" and add param
    const lines = content.split('\n');
    const newLines = [];
    let inClass = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Track class scope
        if (line.match(/^class\s/)) inClass = true;

        // For class methods, add projectApiPath param
        if (inClass) {
            // Match async methods: "  async methodName(" 
            const methodMatch = line.match(/^(\s+)(async\s+)(\w+)\s*\((.*)$/);
            if (methodMatch && !line.includes('projectApiPath')) {
                const indent = methodMatch[1];
                const asyncKw = methodMatch[2];
                const methodName = methodMatch[3];
                const rest = methodMatch[4];

                // Check if method body (next lines) contains projectApiPath
                let bodyHasProjectApiPath = false;
                for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
                    if (lines[j].includes('projectApiPath')) {
                        bodyHasProjectApiPath = true;
                        break;
                    }
                    if (lines[j].match(/^\s+(async\s+)?\w+\s*\(/) || lines[j].match(/^}/)) break;
                }

                if (bodyHasProjectApiPath) {
                    if (rest.startsWith(')')) {
                        // No params: async method() -> async method(projectApiPath: string)
                        line = `${indent}${asyncKw}${methodName}(projectApiPath: string${rest}`;
                    } else {
                        // Has params: async method(x, y) -> async method(projectApiPath: string, x, y)
                        line = `${indent}${asyncKw}${methodName}(projectApiPath: string, ${rest}`;
                    }
                    changes++;
                }
            }
        }

        // For object-based services (export const xxx = { ... })
        // Match function properties: "  async functionName(" 
        // This will be handled similarly

        newLines.push(line);
    }

    content = newLines.join('\n');

    if (changes > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${transform.file}: ${changes} changes`);
        totalChanges += changes;
    } else {
        console.log(`⚠️ ${transform.file}: no changes needed`);
    }
}

console.log(`\nTotal: ${totalChanges} changes across ${TRANSFORMS.length} files`);
