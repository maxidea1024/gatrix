/**
 * Simple refactoring script to rename environment identifiers
 *
 * Renames:
 * - environmentIds → environments
 * - environmentId → environment
 * - envId → env
 * - environmentName → environment
 *
 * Usage:
 *   node archived/refactor-environment-simple.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Directories to process
const DIRS_TO_PROCESS = ['packages/backend/src', 'packages/frontend/src'];

// File extensions to process
const EXTENSIONS = ['.ts', '.tsx'];

// Files to skip
const SKIP_PATTERNS = [/migrations\//, /\.d\.ts$/, /node_modules/];

// Patterns to match and replace
// Order matters - more specific patterns first
const REPLACEMENT_PATTERNS = [
  // Plural form first (more specific)
  { pattern: /\benvironmentIds\b/g, replacement: 'environments' },

  // environmentId -> environment (various contexts)
  { pattern: /\benvironmentId\b/g, replacement: 'environment' },

  // environmentName -> environment
  { pattern: /\benvironmentName\b/g, replacement: 'environment' },

  // envId -> env
  { pattern: /\benvId\b/g, replacement: 'env' },
];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.includes('node_modules')) {
        getAllFiles(filePath, fileList);
      }
    } else if (EXTENSIONS.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return { changed: false, replacements: 0 };
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  let totalReplacements = 0;

  for (const { pattern, replacement } of REPLACEMENT_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      totalReplacements += matches.length;
      content = content.replace(pattern, replacement);
    }
  }

  if (content !== originalContent) {
    console.log(`  ${filePath}: ${totalReplacements} replacements`);

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return { changed: true, replacements: totalReplacements };
  }

  return { changed: false, replacements: 0 };
}

function main() {
  console.log('Environment Identifier Refactoring Script');
  console.log('=========================================');
  console.log(
    'Renames: environmentIds->environments, environmentId->environment, envId->env, environmentName->environment'
  );
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  const projectRoot = path.resolve(__dirname, '..');

  let totalFiles = 0;
  let filesChanged = 0;
  let totalReplacements = 0;

  for (const dir of DIRS_TO_PROCESS) {
    const fullDir = path.join(projectRoot, dir);

    if (!fs.existsSync(fullDir)) {
      console.log(`Directory not found: ${fullDir}`);
      continue;
    }

    console.log(`Processing: ${dir}`);
    const files = getAllFiles(fullDir);
    totalFiles += files.length;

    for (const file of files) {
      const result = processFile(file);
      if (result.changed) {
        filesChanged++;
        totalReplacements += result.replacements;
      }
    }
  }

  console.log('');
  console.log('Summary:');
  console.log(`  Total files scanned: ${totalFiles}`);
  console.log(`  Files changed: ${filesChanged}`);
  console.log(`  Total replacements: ${totalReplacements}`);

  if (DRY_RUN) {
    console.log('');
    console.log('Dry run complete. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  } else if (filesChanged > 0) {
    console.log('');
    console.log('Changes applied successfully!');
    console.log('Run `yarn typecheck` to verify the changes.');
  }
}

main();
