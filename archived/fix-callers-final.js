/**
 * FINAL comprehensive fix script:
 * 1. Fix platformDefaultsService.ts BASE_URL
 * 2. Fix ALL caller files that call services with missing projectApiPath
 * 
 * For callers:
 * - If page already has projectApiPath variable, just add to calls
 * - If page doesn't have it, add useOrgProject import and declaration
 */
const fs = require('fs');
const path = require('path');

const frontendSrc = path.join('packages', 'frontend', 'src');
const svcDir = path.join(frontendSrc, 'services');

// ============================
// Part 1: Fix platformDefaultsService.ts
// ============================
console.log('=== Part 1: platformDefaultsService.ts ===\n');
const pdsPath = path.join(svcDir, 'platformDefaultsService.ts');
let pds = fs.readFileSync(pdsPath, 'utf8');

// Replace static BASE_URL with basePath method
pds = pds.replace(
    `private static readonly BASE_URL = \`\${projectApiPath}/platform-defaults\`;`,
    `private static basePath(projectApiPath: string): string {\n    return \`\${projectApiPath}/platform-defaults\`;\n  }`
);

// Replace this.BASE_URL with this.basePath(projectApiPath) 
pds = pds.replace(/this\.BASE_URL/g, 'this.basePath(projectApiPath)');

// Add projectApiPath param to static async methods
const pdsLines = pds.split('\n');
const pdsResult = [];
const SKIP = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'catch', 'throw', 'new', 'const', 'let', 'var', 'typeof', 'await', 'try', 'function']);

for (let i = 0; i < pdsLines.length; i++) {
    let line = pdsLines[i];
    const m = line.match(/^(\s+)(static\s+async\s+)(\w+)\s*\((.*)$/);
    if (m && !line.includes('projectApiPath') && !SKIP.has(m[3])) {
        let usesIt = false;
        for (let j = i + 1; j < Math.min(i + 20, pdsLines.length); j++) {
            if (pdsLines[j].includes('basePath') || pdsLines[j].includes('projectApiPath')) { usesIt = true; break; }
            if (j > i + 1 && pdsLines[j].match(/^\s+static/)) break;
        }
        if (usesIt) {
            const rest = m[4];
            if (rest.trim().startsWith(')')) {
                line = `${m[1]}${m[2]}${m[3]}(projectApiPath: string${rest}`;
            } else {
                line = `${m[1]}${m[2]}${m[3]}(projectApiPath: string, ${rest}`;
            }
        }
    }
    pdsResult.push(line);
}
pds = pdsResult.join('\n');
fs.writeFileSync(pdsPath, pds, 'utf8');
console.log('✅ platformDefaultsService.ts fixed\n');

// ============================
// Part 2: Build service method registry from all service files
// ============================
console.log('=== Part 2: Build method registry ===\n');

const svcFiles = fs.readdirSync(svcDir).filter(f => f.endsWith('.ts') && f !== 'api.ts' && f !== 'index.ts');
const methodRegistry = {}; // { 'serviceName.methodName': true }

for (const f of svcFiles) {
    const fp = path.join(svcDir, f);
    const content = fs.readFileSync(fp, 'utf8');

    // Find export name: "export const xxx = new Xxx" or "export default new Xxx" or "export default Xxx"
    let exportNames = [];

    // Pattern: export const xxx = new ClassXxx()
    const constExport = content.match(/export\s+const\s+(\w+)\s*=\s*new\s+\w+/);
    if (constExport) exportNames.push(constExport[1]);

    // Pattern: export default new ClassName()
    if (content.match(/export\s+default\s+new\s+\w+/)) {
        // Default export - imported as various names by callers
        // We'll need to check import statements in callers
    }

    // Pattern: export default ClassName (static class)
    const defaultClassExport = content.match(/export\s+default\s+(\w+Service)\s*;?\s*$/m);
    if (defaultClassExport) exportNames.push(defaultClassExport[1]);

    // Find all methods with projectApiPath as first param
    const methodRegex = /(?:async\s+)?(\w+)\s*\(\s*projectApiPath:\s*string/g;
    let mm;
    while ((mm = methodRegex.exec(content))) {
        const methodName = mm[1];
        for (const name of exportNames) {
            methodRegistry[`${name}.${methodName}`] = true;
        }
    }
}

console.log('Method registry:');
for (const key of Object.keys(methodRegistry).sort()) {
    console.log(`  ${key}`);
}

// ============================  
// Part 3: Fix all caller files
// ============================
console.log('\n=== Part 3: Fix caller files ===\n');

function scanDir(dir, results = []) {
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', '__tests__'].includes(entry.name)) continue;
            scanDir(fp, results);
        } else if (/\.(tsx?)$/.test(entry.name)) {
            results.push(fp);
        }
    }
    return results;
}

const allFiles = scanDir(frontendSrc);
let totalFixes = 0;

for (const fp of allFiles) {
    // Skip service files themselves
    if (fp.includes(path.join('services', ''))) continue;

    let content = fs.readFileSync(fp, 'utf8');
    const relPath = path.relative(frontendSrc, fp);
    let changed = false;

    // Check which service methods are called
    for (const key of Object.keys(methodRegistry)) {
        const [svcName, method] = key.split('.');

        // Check if this service+method is used (handle both . and :: patterns)
        const dotCall = new RegExp(`${svcName}\\.${method}\\((?!projectApiPath)`, 'g');
        const staticCall = new RegExp(`${svcName}\\.${method}\\((?!projectApiPath)`, 'g');

        if (dotCall.test(content)) {
            // Reset lastIndex
            dotCall.lastIndex = 0;

            // First ensure file has projectApiPath
            if (!content.includes('projectApiPath')) {
                // Need to add useOrgProject hook
                // Find existing hook usage to know the indent
                const hookMatch = content.match(/\n(\s+)(?:const\s+(?:\{[^}]*\}|\w+)\s*=\s*use\w+)/);
                if (hookMatch) {
                    const indent = hookMatch[1];
                    const insertIdx = content.indexOf(hookMatch[0]);

                    // Check if useOrgProject is already imported
                    if (!content.includes('useOrgProject')) {
                        // Add import
                        // Find last import
                        const importLines = content.split('\n');
                        let lastImportLine = -1;
                        for (let i = 0; i < importLines.length; i++) {
                            if (importLines[i].startsWith('import ')) lastImportLine = i;
                        }
                        if (lastImportLine >= 0) {
                            importLines.splice(lastImportLine + 1, 0, "import { useOrgProject } from '@/contexts/OrgProjectContext';");
                            content = importLines.join('\n');
                        }
                    }

                    // Re-find hook position after possible import addition
                    const hookMatch2 = content.match(/\n(\s+)(?:const\s+(?:\{[^}]*\}|\w+)\s*=\s*use\w+)/);
                    if (hookMatch2) {
                        const insertIdx2 = content.indexOf(hookMatch2[0]);
                        content = content.slice(0, insertIdx2) +
                            `\n${indent}const { getProjectApiPath } = useOrgProject();\n${indent}const projectApiPath = getProjectApiPath();` +
                            content.slice(insertIdx2);
                    }
                    changed = true;
                }
            }

            // Now add projectApiPath to calls
            // Pattern: svc.method(  -> svc.method(projectApiPath, 
            // Pattern: svc.method()  -> svc.method(projectApiPath)
            const callRegex2 = new RegExp(`(${svcName}\\.${method})\\((?!projectApiPath)`, 'g');
            const before2 = content;
            content = content.replace(callRegex2, (match, prefix) => {
                return `${prefix}(projectApiPath, `;
            });

            // Fix: svc.method(projectApiPath, ) -> svc.method(projectApiPath)
            content = content.replace(
                new RegExp(`${svcName}\\.${method}\\(projectApiPath,\\s*\\)`, 'g'),
                `${svcName}.${method}(projectApiPath)`
            );

            if (content !== before2) {
                changed = true;
                totalFixes++;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(fp, content, 'utf8');
        console.log(`✅ ${relPath}`);
    }
}

console.log(`\nTotal caller fixes: ${totalFixes}`);
