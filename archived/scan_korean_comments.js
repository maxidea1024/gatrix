const fs = require('fs');
const path = require('path');

const base = 'c:/work/uwo/gatrix';
const koreanRegex = /[\uAC00-\uD7AF\u3131-\u3163\u318E]/;

// Scan directories
const dirs = [
  'packages/frontend/src/contexts',
  'packages/frontend/src/services',
  'packages/frontend/src/utils',
  'packages/frontend/src/components',
  'packages/frontend/src/pages',
  'packages/frontend/src/hooks',
  'packages/backend/src',
];

const excludeDirs = ['node_modules', 'dist', '.git', 'locales'];
const extensions = ['.ts', '.tsx'];

function walk(dir) {
  const files = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (excludeDirs.includes(f)) continue;
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) files.push(...walk(full));
      else if (extensions.some(ext => f.endsWith(ext))) files.push(full);
    }
  } catch(e) {}
  return files;
}

let totalFiles = 0;
let totalLines = 0;

for (const dir of dirs) {
  const fullDir = path.join(base, dir);
  const files = walk(fullDir);
  
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let fileHasKorean = false;
    
    lines.forEach((line, i) => {
      // Check if line has Korean AND is a comment (// or /* or * or {/* )
      if (!koreanRegex.test(line)) return;
      
      const trimmed = line.trim();
      const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || 
                        trimmed.startsWith('/*') || trimmed.includes('{/*') ||
                        trimmed.includes('*/}');
      
      // Also check for inline comments: code // comment
      const inlineComment = line.includes('//') && koreanRegex.test(line.substring(line.indexOf('//')));
      
      if (isComment || inlineComment) {
        if (!fileHasKorean) {
          const rel = path.relative(base, filePath).replace(/\\/g, '/');
          console.log('\n=== ' + rel + ' ===');
          fileHasKorean = true;
          totalFiles++;
        }
        console.log((i+1) + ': ' + line.substring(0, 160));
        totalLines++;
      }
    });
  }
}

console.log('\n\nTOTAL: ' + totalFiles + ' files, ' + totalLines + ' lines with Korean comments');
