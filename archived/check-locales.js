const fs = require('fs');

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? prefix + '.' + key : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const ko = JSON.parse(fs.readFileSync('packages/frontend/src/locales/ko.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('packages/frontend/src/locales/zh.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('packages/frontend/src/locales/en.json', 'utf8'));

const koKeys = new Set(getAllKeys(ko));
const zhKeys = new Set(getAllKeys(zh));
const enKeys = new Set(getAllKeys(en));

console.log('=== Missing in ZH (from KO) ===');
const missingZH = [...koKeys].filter(k => !zhKeys.has(k));
console.log('Total missing:', missingZH.length);
missingZH.slice(0, 50).forEach(k => console.log(k));
if (missingZH.length > 50) console.log('... and', missingZH.length - 50, 'more');

console.log('\n=== Missing in EN (from KO) ===');
const missingEN = [...koKeys].filter(k => !enKeys.has(k));
console.log('Total missing:', missingEN.length);
missingEN.slice(0, 30).forEach(k => console.log(k));

