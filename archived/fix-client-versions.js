/**
 * Fix clientVersionService.ts:
 * 1. Replace all `this.BASE_URL` with `this.basePath(projectApiPath)` 
 * 2. Add projectApiPath: string param to static async methods that use basePath or call other methods 
 */
const fs = require('fs');
const filePath = 'packages/frontend/src/services/clientVersionService.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Replace this.BASE_URL with this.basePath(projectApiPath)
content = content.replace(/this\.BASE_URL/g, 'this.basePath(projectApiPath)');
console.log('Replaced this.BASE_URL -> this.basePath(projectApiPath)');

// Step 2: Add projectApiPath param to static async methods
const lines = content.split('\n');
const result = [];
const SKIP = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'catch', 'throw', 'new', 'const', 'let', 'var', 'typeof', 'await', 'try', 'function']);

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Match static async methods
    const m = line.match(/^(\s+)(static\s+async\s+)(\w+)\s*\((.*)$/);
    if (m && !line.includes('projectApiPath') && !SKIP.has(m[3])) {
        // Check if method body uses projectApiPath
        let usesIt = false;
        for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
            if (lines[j].includes('projectApiPath') || lines[j].includes('this.basePath') || lines[j].includes('this.getClientVersions') || lines[j].includes('this.getPlatforms') || lines[j].includes('this.findByPlatformAndVersion')) {
                usesIt = true;
                break;
            }
            // Stop at next static method
            if (j > i + 1 && lines[j].match(/^\s+static\s+(async\s+)?\w+/)) break;
        }

        if (usesIt) {
            const indent = m[1];
            const prefix = m[2]; // "static async "
            const name = m[3];
            const rest = m[4];

            if (rest.trim().startsWith(')')) {
                line = `${indent}${prefix}${name}(projectApiPath: string${rest}`;
            } else {
                line = `${indent}${prefix}${name}(projectApiPath: string, ${rest}`;
            }
            console.log(`  Added param to: ${name}`);
        }
    }

    result.push(line);
}

content = result.join('\n');

// Step 3: Fix internal calls that need projectApiPath forwarded
// this.getClientVersions(...) -> this.getClientVersions(projectApiPath, ...)
// this.getPlatforms() -> this.getPlatforms(projectApiPath)
// this.findByPlatformAndVersion(...) -> this.findByPlatformAndVersion(projectApiPath, ...)
content = content.replace(
    /this\.getClientVersions\((?!projectApiPath)/g,
    'this.getClientVersions(projectApiPath, '
);
content = content.replace(
    /this\.getPlatforms\(\)/g,
    'this.getPlatforms(projectApiPath)'
);
content = content.replace(
    /this\.findByPlatformAndVersion\((?!projectApiPath)/g,
    'this.findByPlatformAndVersion(projectApiPath, '
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
