const fs = require('fs');

const files = [
  'packages/frontend/src/locales/ko.json',
  'packages/frontend/src/locales/en.json',
  'packages/frontend/src/locales/zh.json',
];

files.forEach((file) => {
  console.log(`\n=== Processing ${file} ===`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const keys = {};
  const duplicateLines = [];

  lines.forEach((line, idx) => {
    const match = line.match(/^\s*"([^"]+)":/);
    if (match) {
      const key = match[1];
      if (keys[key]) {
        // This is a duplicate, mark the second occurrence for removal
        duplicateLines.push(idx);
        console.log(`  Duplicate: "${key}" at line ${idx + 1} (first at ${keys[key]})`);
      } else {
        keys[key] = idx + 1;
      }
    }
  });

  if (duplicateLines.length > 0) {
    console.log(`  Total duplicates to remove: ${duplicateLines.length}`);

    // Remove duplicate lines (from end to start to preserve indices)
    duplicateLines
      .sort((a, b) => b - a)
      .forEach((idx) => {
        lines.splice(idx, 1);
      });

    // Fix trailing commas - check if any line ends with comma before closing brace
    let result = lines.join('\n');
    // Remove trailing comma before closing brace
    result = result.replace(/,(\s*\n\s*})/g, '$1');

    fs.writeFileSync(file, result);
    console.log(`  Saved ${file}`);
  } else {
    console.log('  No duplicates found');
  }
});

console.log('\nDone!');
