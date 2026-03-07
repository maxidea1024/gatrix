const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gitRoot = 'c:/work/uwo/gatrix';

const targets = [
  'c:/work/uwo/gatrix/packages/shared/src',
  'c:/work/uwo/gatrix/packages/evaluator/src',
  'c:/work/uwo/gatrix/packages/chat-server/src',
  'c:/work/uwo/gatrix/packages/edge/src',
  'c:/work/uwo/gatrix/packages/event-lens/src',
  'c:/work/uwo/gatrix/packages/tools/src',
];

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function shouldSkip(basename) {
  if (basename === basename.toLowerCase()) return true;
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

// Collect all renames
const allRenames = [];
for (const base of targets) {
  for (const filePath of walk(base)) {
    const basename = path.basename(filePath);
    const nameOnly = basename.replace(/\.(ts|js)$/, '');
    const ext = basename.slice(nameOnly.length);
    if (shouldSkip(nameOnly)) continue;
    const kebabName = toKebab(nameOnly);
    if (kebabName === nameOnly) continue;
    const dir = path.dirname(filePath);
    allRenames.push([filePath, path.join(dir, kebabName + ext), nameOnly, kebabName]);
  }
}

console.log(`Found ${allRenames.length} files to rename`);
for (const [oldP, , oldN, newN] of allRenames) {
  console.log(`  ${path.relative(gitRoot, oldP).replace(/\\/g, '/')} -> ${newN}${path.extname(oldP)}`);
}

// Rename
console.log('\n=== Renaming ===');
let ok = 0, errors = 0;
for (const [oldFull, newFull, oldN, newN] of allRenames) {
  if (!fs.existsSync(oldFull)) { console.log(`  SKIP: ${oldN}`); continue; }
  try {
    if (oldFull.toLowerCase() === newFull.toLowerCase()) {
      const tmp = oldFull + '.tmp';
      execSync(`git mv "${oldFull}" "${tmp}"`, { cwd: gitRoot });
      execSync(`git mv "${tmp}" "${newFull}"`, { cwd: gitRoot });
    } else {
      execSync(`git mv "${oldFull}" "${newFull}"`, { cwd: gitRoot });
    }
    console.log(`  OK: ${oldN} -> ${newN}`);
    ok++;
  } catch (err) {
    console.log(`  ERROR: ${oldN}: ${err.stderr?.toString().trim() || err.message}`);
    errors++;
  }
}
console.log(`Renamed: ${ok}, Errors: ${errors}`);

// Update imports across ALL packages
console.log('\n=== Updating imports ===');
const importPairs = allRenames.map(([,, oldN, newN]) => [oldN, newN]);

const searchDirs = [
  ...targets,
  'c:/work/uwo/gatrix/packages/backend/src',
  'c:/work/uwo/gatrix/packages/sdks/server-sdk/src',
  'c:/work/uwo/gatrix/packages/sdks/client-sdks/gatrix-js-client-sdk/src',
];

let filesUpdated = 0;
for (const dir of searchDirs) {
  for (const filePath of walk(dir)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    for (const [oldBasename, newBasename] of importPairs) {
      const regex = new RegExp(`(['"])([^'"]*/)${escapeRegex(oldBasename)}(['"])`, 'g');
      let nc = content.replace(regex, (m, q1, prefix, q2) => `${q1}${prefix}${newBasename}${q2}`);
      const directRegex = new RegExp(`(['"])\\./${escapeRegex(oldBasename)}(['"])`, 'g');
      nc = nc.replace(directRegex, (m, q1, q2) => `${q1}./${newBasename}${q2}`);
      if (nc !== content) { content = nc; changed = true; }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      filesUpdated++;
      console.log(`  UPDATED: ${path.relative(gitRoot, filePath).replace(/\\/g, '/')}`);
    }
  }
}

console.log(`\nDone: ${ok} files renamed, ${filesUpdated} files with import updates`);
