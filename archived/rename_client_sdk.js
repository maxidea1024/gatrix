const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = 'c:/work/uwo/gatrix/packages/sdks/client-sdks/gatrix-js-client-sdk/src';

// Convert PascalCase/camelCase to kebab-case
function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// File rename mappings: [oldRelPath, newRelPath]
const renames = [
  ['EventEmitter.ts', 'event-emitter.ts'],
  ['FeaturesClient.ts', 'features-client.ts'],
  ['FlagProxy.ts', 'flag-proxy.ts'],
  ['GatrixClient.ts', 'gatrix-client.ts'],
  ['InMemoryStorageProvider.ts', 'in-memory-storage-provider.ts'],
  ['LocalStorageProvider.ts', 'local-storage-provider.ts'],
  ['Logger.ts', 'logger.ts'],
  ['Metrics.ts', 'metrics.ts'],
  ['StorageProvider.ts', 'storage-provider.ts'],
  ['VariationProvider.ts', 'variation-provider.ts'],
  ['WatchFlagGroup.ts', 'watch-flag-group.ts'],
  ['contextUtils.ts', 'context-utils.ts'],
  ['validateConfig.ts', 'validate-config.ts'],
  ['valueSource.ts', 'value-source.ts'],
];

// Build import replacement map
const importReplacements = renames.map(([oldRel, newRel]) => [
  path.basename(oldRel, '.ts'),
  path.basename(newRel, '.ts'),
]);

// Step 1: Rename files using git mv
console.log('=== Step 1: Renaming files ===');
for (const [oldRel, newRel] of renames) {
  const oldFull = path.join(base, oldRel);
  const newFull = path.join(base, newRel);
  if (fs.existsSync(oldFull)) {
    try {
      execSync(`git mv "${oldFull}" "${newFull}"`, { cwd: 'c:/work/uwo/gatrix' });
      console.log(`  RENAMED: ${oldRel} -> ${newRel}`);
    } catch (err) {
      console.log(`  ERROR: ${oldRel}: ${err.message}`);
    }
  } else {
    console.log(`  SKIP (not found): ${oldRel}`);
  }
}

// Step 2: Update all import statements
console.log('\n=== Step 2: Updating imports ===');

function walk(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) files.push(...walk(full));
    else if (f.endsWith('.ts')) files.push(full);
  }
  return files;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const allFiles = walk(base);
let totalImportUpdates = 0;

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const [oldBasename, newBasename] of importReplacements) {
    // Match import paths: '../OldName', './OldName', etc.
    const regex = new RegExp(
      `(['"])([^'"]*/)${escapeRegex(oldBasename)}(['"])`,
      'g'
    );
    let newContent = content.replace(regex, (match, q1, prefix, q2) => {
      return `${q1}${prefix}${newBasename}${q2}`;
    });

    // Also match: './OldName'
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
    const rel = path.relative(base, filePath).replace(/\\/g, '/');
    console.log(`  UPDATED: ${rel}`);
  }
}

console.log(`\nTotal: ${renames.length} files renamed, ${totalImportUpdates} import paths updated`);
