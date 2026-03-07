const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = 'c:/work/uwo/gatrix/packages/backend/src';
const gitRoot = 'c:/work/uwo/gatrix';

// Convert PascalCase/camelCase to kebab-case
function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Files/patterns to skip (already lowercase or single word)
function shouldSkip(basename) {
  const lower = basename.toLowerCase();
  // Already all lowercase with no uppercase
  if (basename === lower) return true;
  // Already kebab-case  
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
        if (f === 'node_modules' || f === 'dist' || f === '.git') continue;
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

// Step 1: Find all files that need renaming
console.log('=== Step 1: Finding files to rename ===');
const allFiles = walk(base);
const renames = []; // [oldFull, newFull, oldBasename, newBasename]

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
for (const [oldP, newP, oldN, newN] of renames) {
  const rel = path.relative(base, oldP).replace(/\\/g, '/');
  console.log(`  ${rel} -> ${newN}${path.extname(oldP)}`);
}

// Step 2: Rename files using git mv
console.log('\n=== Step 2: Renaming files ===');
let renameErrors = 0;
for (const [oldFull, newFull, oldN, newN] of renames) {
  if (fs.existsSync(oldFull)) {
    try {
      // On Windows, case-only changes need two-step rename
      if (oldFull.toLowerCase() === newFull.toLowerCase()) {
        const tmpPath = oldFull + '.tmp';
        execSync(`git mv "${oldFull}" "${tmpPath}"`, { cwd: gitRoot });
        execSync(`git mv "${tmpPath}" "${newFull}"`, { cwd: gitRoot });
      } else {
        execSync(`git mv "${oldFull}" "${newFull}"`, { cwd: gitRoot });
      }
      console.log(`  OK: ${oldN} -> ${newN}`);
    } catch (err) {
      console.log(`  ERROR: ${oldN}: ${err.stderr?.toString() || err.message}`);
      renameErrors++;
    }
  }
}
console.log(`Renamed: ${renames.length - renameErrors}, Errors: ${renameErrors}`);

// Step 3: Update all import statements
console.log('\n=== Step 3: Updating imports ===');
const updatedFiles = walk(base);
let totalImportUpdates = 0;
let filesUpdated = 0;

// Build import replacement pairs
const importPairs = renames.map(([,, oldN, newN]) => [oldN, newN]);

for (const filePath of updatedFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const [oldBasename, newBasename] of importPairs) {
    // Match: from './OldName' or from '../dir/OldName' etc.
    // Also match require('./OldName')
    const regex = new RegExp(
      `(['"])([^'"]*/)${escapeRegex(oldBasename)}(['"])`,
      'g'
    );
    let newContent = content.replace(regex, (match, q1, prefix, q2) => {
      return `${q1}${prefix}${newBasename}${q2}`;
    });

    // Direct: './OldName'
    const directRegex = new RegExp(
      `(['"])\\./${escapeRegex(oldBasename)}(['"])`,
      'g'
    );
    newContent = newContent.replace(directRegex, (match, q1, q2) => {
      return `${q1}./${newBasename}${q2}`;
    });

    if (newContent !== content) {
      content = newContent;
      changed = true;
      totalImportUpdates++;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    filesUpdated++;
  }
}

console.log(`\nTotal: ${renames.length} files renamed, ${filesUpdated} files with import updates, ${totalImportUpdates} import replacements`);
