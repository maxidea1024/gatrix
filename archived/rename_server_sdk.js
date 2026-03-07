const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = 'c:/work/uwo/gatrix/packages/sdks/server-sdk/src';
const gitRoot = 'c:/work/uwo/gatrix';

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function shouldSkip(basename) {
  const lower = basename.toLowerCase();
  if (basename === lower) return true;
  if (basename.includes('-')) return true;
  return false;
}

function walk(dir) {
  const files = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (f === 'node_modules' || f === 'dist') continue;
        files.push(...walk(full));
      } else if (f.endsWith('.ts') || f.endsWith('.js')) {
        files.push(full);
      }
    }
  } catch(e) {}
  return files;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Step 1: Find files to rename
console.log('=== Step 1: Finding files to rename ===');
const allFiles = walk(base);
const renames = [];

for (const filePath of allFiles) {
  const basename = path.basename(filePath);
  const nameOnly = basename.replace(/\.(ts|js)$/, '');
  const ext = basename.slice(nameOnly.length);
  
  if (shouldSkip(nameOnly)) continue;
  
  const kebabName = toKebab(nameOnly);
  if (kebabName === nameOnly) continue;
  
  const dir = path.dirname(filePath);
  const newPath = path.join(dir, kebabName + ext);
  
  renames.push([filePath, newPath, nameOnly, kebabName]);
}

console.log(`Found ${renames.length} files to rename`);
for (const [oldP, , oldN, newN] of renames) {
  const rel = path.relative(base, oldP).replace(/\\/g, '/');
  console.log(`  ${rel} -> ${newN}${path.extname(oldP)}`);
}

// Step 2: Rename files
console.log('\n=== Step 2: Renaming files ===');
let renameErrors = 0;
for (const [oldFull, newFull, oldN, newN] of renames) {
  if (fs.existsSync(oldFull)) {
    try {
      if (oldFull.toLowerCase() === newFull.toLowerCase()) {
        const tmpPath = oldFull + '.tmp';
        execSync(`git mv "${oldFull}" "${tmpPath}"`, { cwd: gitRoot });
        execSync(`git mv "${tmpPath}" "${newFull}"`, { cwd: gitRoot });
      } else {
        execSync(`git mv "${oldFull}" "${newFull}"`, { cwd: gitRoot });
      }
      console.log(`  OK: ${oldN} -> ${newN}`);
    } catch (err) {
      console.log(`  ERROR: ${oldN}: ${err.stderr?.toString().trim() || err.message}`);
      renameErrors++;
    }
  }
}

// Step 3: Update imports
console.log('\n=== Step 3: Updating imports ===');
const updatedFiles = walk(base);
const importPairs = renames.map(([,, oldN, newN]) => [oldN, newN]);
let totalUpdates = 0;
let filesUpdated = 0;

for (const filePath of updatedFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const [oldBasename, newBasename] of importPairs) {
    const regex = new RegExp(
      `(['"])([^'"]*/)${escapeRegex(oldBasename)}(['"])`, 'g'
    );
    let newContent = content.replace(regex, (m, q1, prefix, q2) => `${q1}${prefix}${newBasename}${q2}`);
    
    const directRegex = new RegExp(
      `(['"])\\./${escapeRegex(oldBasename)}(['"])`, 'g'
    );
    newContent = newContent.replace(directRegex, (m, q1, q2) => `${q1}./${newBasename}${q2}`);

    if (newContent !== content) {
      content = newContent;
      changed = true;
      totalUpdates++;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    filesUpdated++;
    console.log(`  UPDATED: ${path.relative(base, filePath).replace(/\\/g, '/')}`);
  }
}

// Also update imports in edge that reference server-sdk
const edgeBase = 'c:/work/uwo/gatrix/packages/edge/src';
const edgeFiles = walk(edgeBase);
for (const filePath of edgeFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const [oldBasename, newBasename] of importPairs) {
    if (content.includes(oldBasename)) {
      const regex = new RegExp(escapeRegex(oldBasename), 'g');
      // Only replace in import/require statements
      const importRegex = new RegExp(
        `(from\\s+['"][^'"]*/)${escapeRegex(oldBasename)}(['"])`, 'g'
      );
      const newContent = content.replace(importRegex, `$1${newBasename}$2`);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  UPDATED (edge): ${path.relative(edgeBase, filePath).replace(/\\/g, '/')}`);
  }
}

console.log(`\nTotal: ${renames.length} files renamed (${renameErrors} errors), ${filesUpdated} files with import updates`);
