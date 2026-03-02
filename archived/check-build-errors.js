const { execSync } = require('child_process');
let out;
try {
    out = execSync('yarn workspace @gatrix/frontend tsc --noEmit 2>&1', {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
        cwd: process.cwd(),
    });
} catch (e) {
    out = e.stdout || '';
}

const errors = out.split('\n').filter(l => l.includes('error TS'));
console.log(`Total errors: ${errors.length}\n`);

const byFile = {};
for (const e of errors) {
    const m = e.match(/^(src\/[^(]+)\((\d+),(\d+)\):\s*(error TS\d+:\s*.+)/);
    if (m) {
        const file = m[1];
        const line = m[2];
        const msg = m[4].substring(0, 120);
        if (!byFile[file]) byFile[file] = [];
        byFile[file].push(`  L${line}: ${msg}`);
    }
}

for (const [file, errs] of Object.entries(byFile)) {
    console.log(`${file} (${errs.length}):`);
    errs.forEach(e => console.log(e));
    console.log();
}
