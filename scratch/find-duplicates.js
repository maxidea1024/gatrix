const fs = require('fs');
const path = require('path');

const localesDir = 'c:/work/uwo/gatrix/packages/frontend/src/locales';

function findDuplicates(filename) {
  const content = fs.readFileSync(path.join(localesDir, filename), 'utf8');
  const lines = content.split(/\r?\n/);
  const keyMap = new Map();
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key).push({ lineNum: idx + 1, val });
    }
  });
  
  console.log(`\n=== DUPLICATES IN ${filename} ===`);
  for (const [key, occurrences] of keyMap.entries()) {
    if (occurrences.length > 1) {
      // Check if values differ
      const uniqueVals = new Set(occurrences.map(o => o.val));
      if (uniqueVals.size > 1) {
        console.log(`Key: ${key} (CONFLICTING VALUES)`);
        occurrences.forEach(o => {
          console.log(`  Line ${o.lineNum}: ${o.val}`);
        });
      }
    }
  }
}

findDuplicates('ko.ini');
findDuplicates('en.ini');
findDuplicates('zh.ini');
