/**
 * Scan for inline callbacks passed to React.memo components.
 * 
 * Strategy:
 * 1. Find all React.memo component names
 * 2. For each, search for <ComponentName ... on={...=> or on={function
 * 3. Report file, line, component, prop
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// Step 1: Collect all React.memo component names
const memoComponents = new Set();

function findMemoComponents(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      findMemoComponents(full);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      // Match: export default React.memo(ComponentName)
      const m1 = content.matchAll(/React\.memo\((\w+)/g);
      for (const m of m1) {
        memoComponents.add(m[1]);
      }
      // Match: const ComponentName = React.memo<...>(
      const m2 = content.matchAll(/const\s+(\w+)\s*=\s*React\.memo/g);
      for (const m of m2) {
        memoComponents.add(m[1]);
      }
      // Match: const ComponentName: ... = React.memo(
      const m3 = content.matchAll(/const\s+(\w+):\s*\S+\s*=\s*React\.memo/g);
      for (const m of m3) {
        memoComponents.add(m[1]);
      }
    }
  }
}

findMemoComponents(SRC);

console.log(`Found ${memoComponents.size} React.memo components:`);
console.log([...memoComponents].sort().join(', '));
console.log('');

// Step 2: For each TSX file, find <MemoComponent ... on*={() => ...}> patterns
const results = [];

function scanForInlineCallbacks(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      scanForInlineCallbacks(full);
    } else if (entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      
      // Find JSX usage of memo components with inline callbacks
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this line has <MemoComponent
        for (const comp of memoComponents) {
          if (line.includes(`<${comp}`) || line.includes(`<${comp} `)) {
            // Scan the next 50 lines for inline callbacks
            for (let j = i; j < Math.min(i + 50, lines.length); j++) {
              const propLine = lines[j];
              // Match: on*={(   or on*={function   or on*={(e) =>
              const inlineMatch = propLine.match(/(\w+)=\{(?:\([^)]*\)\s*=>|function|\(\)\s*=>|\([^)]*\)\s*=>\s*\{)/);
              if (inlineMatch) {
                const propName = inlineMatch[1];
                // Only care about callback props (on*, handle*, etc.)
                if (propName.startsWith('on') || propName.startsWith('handle')) {
                  results.push({
                    file: path.relative(SRC, full).replace(/\\/g, '/'),
                    line: j + 1,
                    component: comp,
                    prop: propName,
                    code: propLine.trim().substring(0, 100),
                  });
                }
              }
              // Stop if we hit /> or > on its own line (end of JSX tag)
              if (propLine.trim() === '/>' || propLine.trim() === '>') break;
            }
          }
        }
      }
    }
  }
}

scanForInlineCallbacks(SRC);

// Deduplicate
const seen = new Set();
const deduped = results.filter(r => {
  const key = `${r.file}:${r.line}:${r.prop}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`Found ${deduped.length} inline callbacks on React.memo components:\n`);
for (const r of deduped) {
  console.log(`${r.file}:${r.line} <${r.component}> ${r.prop}`);
  console.log(`  ${r.code}`);
  console.log('');
}
