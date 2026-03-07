const fs = require('fs');
const path = require('path');

const base = 'c:/work/uwo/gatrix/packages/edge/src';

// File rename mappings: [oldRelPath, newRelPath] (kebab-case)
const renames = [
  ['internalApp.ts', 'internal-app.ts'],
  ['middleware/clientAuth.ts', 'middleware/client-auth.ts'],
  ['services/FlagStreamingService.ts', 'services/flag-streaming-service.ts'],
  ['services/edgeMetrics.ts', 'services/edge-metrics.ts'],
  ['services/metricsAggregator.ts', 'services/metrics-aggregator.ts'],
  ['services/requestStats.ts', 'services/request-stats.ts'],
  ['services/sdkManager.ts', 'services/sdk-manager.ts'],
  ['services/tokenMirrorService.ts', 'services/token-mirror-service.ts'],
  ['services/tokenUsageTracker.ts', 'services/token-usage-tracker.ts'],
  ['utils/apiResponse.ts', 'utils/api-response.ts'],
  ['utils/evaluationHelper.ts', 'utils/evaluation-helper.ts'],
];

// Build import path replacement map
const importReplacements = [];
for (const [oldRel, newRel] of renames) {
  const oldBase = path.basename(oldRel, '.ts');
  const newBase = path.basename(newRel, '.ts');
  importReplacements.push([oldBase, newBase]);
}

// Step 1: Rename files using git mv
console.log('=== Step 1: Renaming files ===');
const { execSync } = require('child_process');
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

// Step 2: Update all import statements in all edge .ts files
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
    // Match import paths containing the old filename
    // e.g., '../services/sdkManager' -> '../services/sdk-manager'
    // e.g., './internalApp' -> './internal-app'
    const regex = new RegExp(
      `(['"])([^'"]*/)${escapeRegex(oldBasename)}(['"])`,
      'g'
    );
    const newContent = content.replace(regex, (match, q1, prefix, q2) => {
      return `${q1}${prefix}${newBasename}${q2}`;
    });

    // Also match direct relative: './oldBasename'
    const directRegex = new RegExp(
      `(['"])\\./${escapeRegex(oldBasename)}(['"])`,
      'g'
    );
    const newContent2 = newContent.replace(directRegex, (match, q1, q2) => {
      return `${q1}./${newBasename}${q2}`;
    });

    if (newContent2 !== content) {
      content = newContent2;
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
