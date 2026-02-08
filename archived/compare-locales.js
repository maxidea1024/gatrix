/**
 * Script to compare locale files and find differences
 * Using ko.json as the reference
 */
const fs = require('fs');
const path = require('path');

const localesDir = 'c:/work/uwo/gatrix/packages/frontend/src/locales';

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Load all locale files
const koContent = fs.readFileSync(path.join(localesDir, 'ko.json'), 'utf8');
const enContent = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8');
const zhContent = fs.readFileSync(path.join(localesDir, 'zh.json'), 'utf8');

const ko = JSON.parse(koContent);
const en = JSON.parse(enContent);
const zh = JSON.parse(zhContent);

const koKeys = new Set(getAllKeys(ko));
const enKeys = new Set(getAllKeys(en));
const zhKeys = new Set(getAllKeys(zh));

console.log('=== Locale File Comparison ===\n');
console.log(`ko.json: ${koKeys.size} keys`);
console.log(`en.json: ${enKeys.size} keys`);
console.log(`zh.json: ${zhKeys.size} keys`);

// Find keys missing in each file (compared to ko.json as reference)
console.log('\n--- Keys in ko.json but MISSING in en.json ---');
const missingInEn = [...koKeys].filter((k) => !enKeys.has(k));
if (missingInEn.length > 0) {
  missingInEn.slice(0, 30).forEach((k) => console.log(`  ${k}`));
  if (missingInEn.length > 30) console.log(`  ... and ${missingInEn.length - 30} more`);
} else {
  console.log('  (none)');
}

console.log('\n--- Keys in ko.json but MISSING in zh.json ---');
const missingInZh = [...koKeys].filter((k) => !zhKeys.has(k));
if (missingInZh.length > 0) {
  missingInZh.slice(0, 30).forEach((k) => console.log(`  ${k}`));
  if (missingInZh.length > 30) console.log(`  ... and ${missingInZh.length - 30} more`);
} else {
  console.log('  (none)');
}

// Find extra keys in en.json and zh.json (not in ko.json)
console.log('\n--- Keys in en.json but NOT in ko.json (extra) ---');
const extraInEn = [...enKeys].filter((k) => !koKeys.has(k));
if (extraInEn.length > 0) {
  extraInEn.slice(0, 30).forEach((k) => console.log(`  ${k}`));
  if (extraInEn.length > 30) console.log(`  ... and ${extraInEn.length - 30} more`);
} else {
  console.log('  (none)');
}

console.log('\n--- Keys in zh.json but NOT in ko.json (extra) ---');
const extraInZh = [...zhKeys].filter((k) => !koKeys.has(k));
if (extraInZh.length > 0) {
  extraInZh.slice(0, 30).forEach((k) => console.log(`  ${k}`));
  if (extraInZh.length > 30) console.log(`  ... and ${extraInZh.length - 30} more`);
} else {
  console.log('  (none)');
}

// Summary
console.log('\n=== Summary ===');
console.log(`Missing in en.json: ${missingInEn.length} keys`);
console.log(`Missing in zh.json: ${missingInZh.length} keys`);
console.log(`Extra in en.json: ${extraInEn.length} keys`);
console.log(`Extra in zh.json: ${extraInZh.length} keys`);

// Output to files for detailed review
fs.writeFileSync(
  path.join('c:/work/uwo/gatrix/archived', 'missing_in_en.txt'),
  missingInEn.join('\n')
);
fs.writeFileSync(
  path.join('c:/work/uwo/gatrix/archived', 'missing_in_zh.txt'),
  missingInZh.join('\n')
);
fs.writeFileSync(path.join('c:/work/uwo/gatrix/archived', 'extra_in_en.txt'), extraInEn.join('\n'));
fs.writeFileSync(path.join('c:/work/uwo/gatrix/archived', 'extra_in_zh.txt'), extraInZh.join('\n'));

console.log('\nDetailed lists saved to archived/*.txt files');
