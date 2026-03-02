/**
 * Fix duplicate projectApiPath params in service files.
 * Pattern: async methodName(projectApiPath: string, projectApiPath: string, ...)
 * -> async methodName(projectApiPath: string, ...)
 */
const fs = require('fs');
const path = require('path');

const svcDir = path.join('packages', 'frontend', 'src', 'services');
const files = fs.readdirSync(svcDir).filter(f => f.endsWith('.ts'));

let totalFixes = 0;

for (const f of files) {
    const fp = path.join(svcDir, f);
    let content = fs.readFileSync(fp, 'utf8');

    // Fix duplicate projectApiPath params
    const before = content;
    content = content.replace(
        /projectApiPath:\s*string,\s*\n?\s*projectApiPath:\s*string/g,
        'projectApiPath: string'
    );
    content = content.replace(
        /projectApiPath:\s*string,\s*projectApiPath:\s*string/g,
        'projectApiPath: string'
    );

    if (content !== before) {
        fs.writeFileSync(fp, content, 'utf8');
        const count = (before.match(/projectApiPath:\s*string,\s*\n?\s*projectApiPath:\s*string/g) || []).length;
        console.log(`✅ ${f}: ${count} duplicates removed`);
        totalFixes += count;
    }
}

// Fix clientVersionService.ts and platformDefaultsService.ts
// These are not class-based, they're function-based or object-based
// Need to check if projectApiPath is used but not declared
for (const f of ['clientVersionService.ts', 'platformDefaultsService.ts']) {
    const fp = path.join(svcDir, f);
    if (!fs.existsSync(fp)) continue;

    let content = fs.readFileSync(fp, 'utf8');

    // Check if projectApiPath is used but file has no "projectApiPath: string" parameter declarations
    if (content.includes('projectApiPath') && !content.includes('projectApiPath: string')) {
        console.log(`⚠️ ${f}: has projectApiPath usage but no param declaration`);

        // Find all function declarations and add param
        const lines = content.split('\n');
        const result = [];
        const SKIP = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'catch', 'throw', 'new', 'const', 'let', 'var', 'typeof', 'await', 'try', 'function']);

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            const m = line.match(/^(\s*)(async\s+)?(\w+)\s*\((.*)$/);
            if (m && !line.includes('projectApiPath') && !SKIP.has(m[3])) {
                let usesIt = false;
                for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
                    if (lines[j].includes('projectApiPath')) { usesIt = true; break; }
                    if (j > i + 1 && lines[j].match(/^\s*(async\s+)?\w+\s*\(/) && !SKIP.has((lines[j].match(/(\w+)\s*\(/) || [])[1])) break;
                }

                if (usesIt) {
                    const rest = m[4];
                    if (rest.trim().startsWith(')')) {
                        line = `${m[1]}${m[2] || ''}${m[3]}(projectApiPath: string${rest}`;
                    } else {
                        line = `${m[1]}${m[2] || ''}${m[3]}(projectApiPath: string, ${rest}`;
                    }
                    totalFixes++;
                }
            }
            result.push(line);
        }

        content = result.join('\n');
        fs.writeFileSync(fp, content, 'utf8');
        console.log(`✅ ${f}: params added`);
    }
}

console.log(`\nTotal fixes: ${totalFixes}`);
