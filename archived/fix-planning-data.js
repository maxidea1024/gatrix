/**
 * Fix planningDataService.ts:
 * 1. Replace '/admin/planning-data/...' with `${projectApiPath}/planning-data/...`
 * 2. Add projectApiPath: string param to each method
 */
const fs = require('fs');
const filePath = 'packages/frontend/src/services/planningDataService.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Replace all '/admin/planning-data...' patterns
// Handle: api.get('/admin/planning-data/reward-lookup', {
// Handle: api.post('/admin/planning-data/rebuild');
// Handle: api.get('/admin/planning-data/reward-types');

// Replace single-quoted standalone paths: '/admin/planning-data/xxx'
// These become: `${projectApiPath}/planning-data/xxx`
content = content.replace(
    /'\/admin\/planning-data\/([^']+)'/g,
    '`${projectApiPath}/planning-data/$1`'
);

// Replace single-quoted standalone: '/admin/planning-data' (no trailing path)
content = content.replace(
    /'\/admin\/planning-data'/g,
    '`${projectApiPath}/planning-data`'
);

// Step 2: Add projectApiPath param to class methods
// Find: "async methodName(" without projectApiPath and add it
const lines = content.split('\n');
const result = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Match class method signatures
    const methodMatch = line.match(/^(\s+)(async\s+)(\w+)\s*\((.*)$/);
    if (methodMatch && !line.includes('projectApiPath')) {
        // Check if the method body uses projectApiPath
        let usesProjectApiPath = false;
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
            if (lines[j].includes('projectApiPath')) {
                usesProjectApiPath = true;
                break;
            }
            // Stop at next method or closing brace at same indent
            if (lines[j].match(/^\s+(async\s+)?\w+\s*\(/) && j > i + 1) break;
        }

        if (usesProjectApiPath) {
            const indent = methodMatch[1];
            const asyncKw = methodMatch[2];
            const methodName = methodMatch[3];
            const rest = methodMatch[4];

            if (rest.startsWith(')')) {
                // No params: async method() -> async method(projectApiPath: string)
                line = `${indent}${asyncKw}${methodName}(projectApiPath: string${rest}`;
            } else {
                // Has params: async method(x) -> async method(projectApiPath: string, x)
                line = `${indent}${asyncKw}${methodName}(projectApiPath: string, ${rest}`;
            }
        }
    }

    result.push(line);
}

content = result.join('\n');
fs.writeFileSync(filePath, content, 'utf8');

// Verify
const remaining = content.match(/'\/admin\//g);
console.log('Remaining /admin/ references:', remaining ? remaining.length : 0);

const projectPaths = content.match(/projectApiPath/g);
console.log('projectApiPath references:', projectPaths ? projectPaths.length : 0);
