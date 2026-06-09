const fs = require('fs');
const path = require('path');

const localesDir = 'c:/work/uwo/gatrix/packages/frontend/src/locales';

function parseIni(content) {
  const map = new Map();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      map.set(trimmed.substring(0, eqIdx).trim(), trimmed.substring(eqIdx + 1).trim());
    }
  }
  return map;
}

const koMap = parseIni(fs.readFileSync(path.join(localesDir, 'ko.ini'), 'utf8'));
const enMap = parseIni(fs.readFileSync(path.join(localesDir, 'en.ini'), 'utf8'));
const zhMap = parseIni(fs.readFileSync(path.join(localesDir, 'zh.ini'), 'utf8'));

// Print missing in ko.ini
console.log('--- MISSING IN ko.ini ---');
for (const key of enMap.keys()) {
  if (!koMap.has(key)) {
    console.log(`${key}=${enMap.get(key)}`);
  }
}

// Print missing in zh.ini (with their English values)
console.log('\n--- MISSING IN zh.ini ---');
for (const key of koMap.keys()) {
  if (!zhMap.has(key)) {
    const enVal = enMap.get(key) || '(No English value)';
    const koVal = koMap.get(key);
    console.log(`${key}=${koVal}  [EN: ${enVal}]`);
  }
}
