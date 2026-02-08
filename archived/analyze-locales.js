/**
 * Script to find duplicate keys in locale JSON files
 */
const fs = require('fs');
const path = require('path');

const localesDir = 'c:/work/uwo/gatrix/packages/frontend/src/locales';

function findDuplicateKeys(obj, prefix = '', duplicates = [], keyLocations = {}) {
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      findDuplicateKeys(obj[key], fullKey, duplicates, keyLocations);
    }
  }
  return duplicates;
}

function findDuplicatesInRawJson(content, filename) {
  const lines = content.split('\n');
  const keyPattern = /^\s*"([^"]+)":/;
  const keyLocations = {};
  const duplicates = [];
  const stack = []; // Track nested object paths

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(keyPattern);

    // Track opening/closing braces for nested context
    if (line.includes('{')) {
      if (match) {
        stack.push(match[1]);
      }
    }
    if (line.includes('}')) {
      stack.pop();
    }

    if (match) {
      const key = match[1];
      const fullPath = [...stack, key].join('.');

      if (!keyLocations[fullPath]) {
        keyLocations[fullPath] = [];
      }
      keyLocations[fullPath].push(i + 1);
    }
  }

  // Find duplicates
  for (const [key, locations] of Object.entries(keyLocations)) {
    if (locations.length > 1) {
      duplicates.push({ key, locations });
    }
  }

  return duplicates;
}

// Simple approach: find consecutive duplicate keys
function findConsecutiveDuplicates(content, filename) {
  const lines = content.split('\n');
  const keyPattern = /^\s*"([^"]+)":/;
  const duplicates = [];
  let lastKey = null;
  let lastLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(keyPattern);

    if (match) {
      const key = match[1];
      if (key === lastKey && i === lastLine + 1) {
        duplicates.push({ key, firstLine: lastLine + 1, secondLine: i + 1 });
      }
      lastKey = key;
      lastLine = i;
    }
  }

  return duplicates;
}

// Compare key counts between files
function compareKeyStructure(files) {
  const fileCounts = {};

  for (const file of files) {
    const content = fs.readFileSync(path.join(localesDir, file), 'utf8');
    const json = JSON.parse(content);

    function countKeys(obj, prefix = '') {
      let count = 0;
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          count += countKeys(obj[key], fullKey);
        } else {
          count++;
        }
      }
      return count;
    }

    fileCounts[file] = {
      topLevelKeys: Object.keys(json).length,
      totalKeys: countKeys(json),
    };
  }

  return fileCounts;
}

// Main
const files = ['ko.json', 'en.json', 'zh.json'];

console.log('=== Locale File Analysis ===\n');

// 1. Compare key counts
console.log('1. Key Count Comparison:');
const counts = compareKeyStructure(files);
for (const [file, data] of Object.entries(counts)) {
  console.log(`   ${file}: ${data.topLevelKeys} top-level keys, ${data.totalKeys} total keys`);
}

console.log('\n2. Duplicate Key Check (Consecutive):');

for (const file of files) {
  const content = fs.readFileSync(path.join(localesDir, file), 'utf8');
  const duplicates = findConsecutiveDuplicates(content, file);

  if (duplicates.length > 0) {
    console.log(`\n   ${file}:`);
    for (const dup of duplicates) {
      console.log(
        `     - Key "${dup.key}" duplicated at lines ${dup.firstLine} and ${dup.secondLine}`
      );
    }
  } else {
    console.log(`   ${file}: No consecutive duplicates found`);
  }
}

// 3. Check specific lines mentioned by user
console.log('\n3. Checking specific lines mentioned:');

// Check zh.json lines 4962-4963
const zhContent = fs.readFileSync(path.join(localesDir, 'zh.json'), 'utf8').split('\n');
console.log(`   zh.json line 4962: ${zhContent[4961]?.trim()}`);
console.log(`   zh.json line 4963: ${zhContent[4962]?.trim()}`);

// Check en.json lines 4795-4796
const enContent = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8').split('\n');
console.log(`   en.json line 4795: ${enContent[4794]?.trim()}`);
console.log(`   en.json line 4796: ${enContent[4795]?.trim()}`);

console.log('\n=== Analysis Complete ===');
