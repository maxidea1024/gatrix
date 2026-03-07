/**
 * Comprehensive fix for all TypeScript errors caused by projectApiPath migration.
 * 
 * Strategy:
 * 1. Fix service files that still have projectApiPath references without params
 * 2. Find all caller files and:
 *    a. Add getProjectApiPath / useOrgProject import if missing
 *    b. Add projectApiPath declaration if missing
 *    c. Add projectApiPath as first argument to all service method calls
 */
const fs = require('fs');
const path = require('path');

const frontendSrc = path.join('packages', 'frontend', 'src');
const svcDir = path.join(frontendSrc, 'services');

// ================================
// Part 1: Fix remaining service param issues
// ================================
console.log('=== Part 1: Service files ===\n');

const svcFiles = fs.readdirSync(svcDir).filter(f => f.endsWith('.ts'));
for (const f of svcFiles) {
    const fp = path.join(svcDir, f);
    let content = fs.readFileSync(fp, 'utf8');
    if (!content.includes('projectApiPath')) continue;

    // Check for "Cannot find name 'projectApiPath'" pattern
    // This happens when projectApiPath is used inside a method but not declared as parameter
    const lines = content.split('\n');
    const result = [];
    let fixed = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Match function/method signature
        const methodMatch = line.match(/^(\s*)(async\s+)?(\w+)\s*\((.*)$/);
        if (methodMatch && !line.includes('projectApiPath') && !line.includes('constructor') && !line.includes('private') && !line.includes('//')) {
            let usesIt = false;
            // Check next 40 lines for projectApiPath usage
            for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
                if (lines[j].includes('projectApiPath') && !lines[j].includes('async ')) {
                    usesIt = true;
                    break;
                }
                // Stop at next method or class end
                if (j > i + 1 && lines[j].match(/^\s*(async\s+)?\w+\s*\(/) && !lines[j].startsWith('    ') && !lines[j].startsWith('\t\t')) break;
                if (lines[j].match(/^  async /) || lines[j].match(/^  \w+\(/)) break;
            }

            if (usesIt) {
                const indent = methodMatch[1];
                const asyncKw = methodMatch[2] || '';
                const name = methodMatch[3];
                const rest = methodMatch[4];

                if (rest.trim().startsWith(')') || rest.trim() === '') {
                    line = `${indent}${asyncKw}${name}(projectApiPath: string${rest}`;
                } else {
                    line = `${indent}${asyncKw}${name}(projectApiPath: string, ${rest}`;
                }
                fixed++;
            }
        }
        result.push(line);
    }

    if (fixed > 0) {
        fs.writeFileSync(fp, result.join('\n'), 'utf8');
        console.log(`✅ ${f}: ${fixed} methods fixed`);
    }
}

// ================================
// Part 2: Fix caller files
// ================================
console.log('\n=== Part 2: Caller files ===\n');

// Service method names to look for
const SERVICE_METHODS = {};
for (const f of svcFiles) {
    const fp = path.join(svcDir, f);
    const content = fs.readFileSync(fp, 'utf8');
    if (!content.includes('projectApiPath')) continue;

    // Find the exported variable name
    const exportMatch = content.match(/export\s+(?:const|default)\s+(?:new\s+)?(\w+)/);
    const defaultExport = content.match(/export\s+default\s+new\s+(\w+)/);

    // Get class/object name
    let varName;
    if (content.match(/class\s+(\w+)/)) {
        // Class-based service - find export
        const classMatch = content.match(/class\s+(\w+)/);
        const className = classMatch[1];
        // Find: export const xxx = new ClassName()
        const instanceMatch = content.match(/export\s+const\s+(\w+)\s*=\s*new/);
        // Or: export default new ClassName()
        if (instanceMatch) {
            varName = instanceMatch[1];
        } else if (defaultExport) {
            // Default import - caller uses whatever name they give
            // We'll detect from import statements
            varName = null;
        }
    }

    if (!varName) continue;

    // Find all method names that have projectApiPath as first param
    const methodPattern = /async\s+(\w+)\s*\(\s*projectApiPath:\s*string/g;
    let mm;
    const methods = [];
    while ((mm = methodPattern.exec(content))) {
        methods.push(mm[1]);
    }

    if (methods.length > 0) {
        SERVICE_METHODS[varName] = methods;
    }
}

console.log('Service methods requiring projectApiPath:');
for (const [svc, methods] of Object.entries(SERVICE_METHODS)) {
    console.log(`  ${svc}: ${methods.join(', ')}`);
}

// Now scan all page/component files
function scanDir(dir, results = []) {
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', '__tests__'].includes(entry.name)) continue;
            scanDir(fp, results);
        } else if (/\.(tsx?)$/.test(entry.name) && !fp.includes('services')) {
            results.push(fp);
        }
    }
    return results;
}

const callerFiles = scanDir(frontendSrc);
let totalCallerFixes = 0;

for (const fp of callerFiles) {
    let content = fs.readFileSync(fp, 'utf8');
    const relPath = path.relative(frontendSrc, fp);
    let fileChanged = false;

    // Check which services are used in this file
    const usedServices = [];
    for (const [svcVar, methods] of Object.entries(SERVICE_METHODS)) {
        for (const method of methods) {
            const callPattern = new RegExp(`${svcVar}\\.${method}\\(`, 'g');
            if (callPattern.test(content)) {
                if (!usedServices.includes(svcVar)) usedServices.push(svcVar);
            }
        }
    }

    if (usedServices.length === 0) continue;

    // Check if file has projectApiPath
    const hasProjectApiPath = content.includes('projectApiPath');
    const hasGetProjectApiPath = content.includes('getProjectApiPath');
    const hasUseOrgProject = content.includes('useOrgProject');

    // Add getProjectApiPath if not present
    if (!hasProjectApiPath && !hasGetProjectApiPath) {
        // Need to add useOrgProject import and declaration
        // Find appropriate location for import
        if (!hasUseOrgProject) {
            // Add import at end of imports
            const lastImportIdx = content.lastIndexOf("import ");
            if (lastImportIdx >= 0) {
                const lineEnd = content.indexOf('\n', lastImportIdx);
                const insertPoint = content.indexOf('\n', lineEnd);
                content = content.slice(0, insertPoint) + "\nimport { useOrgProject } from '../../contexts/OrgProjectContext';" + content.slice(insertPoint);
                fileChanged = true;
            }
        }

        // Find component function and add hook
        // Look for: export default function X or const X = () => or function X(
        const hookPattern = /\n(\s+)(?:const\s+\{[^}]*\}\s*=\s*use\w+|const\s+\w+\s*=\s*use\w+)/;
        const hookMatch = content.match(hookPattern);
        if (hookMatch) {
            const insertIdx = content.indexOf(hookMatch[0]);
            const indent = hookMatch[1];
            content = content.slice(0, insertIdx) + `\n${indent}const { getProjectApiPath } = useOrgProject();\n${indent}const projectApiPath = getProjectApiPath();` + content.slice(insertIdx);
            fileChanged = true;
        }
    }

    // Now add projectApiPath to method calls
    for (const svcVar of usedServices) {
        const methods = SERVICE_METHODS[svcVar];
        for (const method of methods) {
            // Replace: svcVar.method( -> svcVar.method(projectApiPath, 
            // But NOT if already has projectApiPath as first arg
            const callRegex = new RegExp(`(${svcVar}\\.${method})\\((?!projectApiPath)`, 'g');
            const before = content;
            content = content.replace(callRegex, (match, prefix) => {
                // Check if the next char after ( is )
                const afterParen = content.substring(content.indexOf(match) + match.length);
                if (afterParen.startsWith(')')) {
                    return `${prefix}(projectApiPath`;
                }
                return `${prefix}(projectApiPath, `;
            });
            if (content !== before) {
                fileChanged = true;
                totalCallerFixes++;
            }
        }
    }

    if (fileChanged) {
        fs.writeFileSync(fp, content, 'utf8');
        console.log(`✅ ${relPath}: fixed`);
    }
}

console.log(`\nTotal caller fixes: ${totalCallerFixes}`);
