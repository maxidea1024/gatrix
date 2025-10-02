const fs = require('fs');

// Load files
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('src/locales/zh.json', 'utf8'));

console.log('EN 최상위 키:', Object.keys(en).length);
console.log('ZH 최상위 키:', Object.keys(zh).length);

// Create new zh object with same structure as en
const newZh = {};

// Copy keys from en in the same order
Object.keys(en).forEach(key => {
  if (zh[key]) {
    // Use existing zh translation
    newZh[key] = zh[key];
    console.log('✅ 유지:', key);
  } else {
    // Use en as fallback (needs translation)
    newZh[key] = en[key];
    console.log('⚠️  영어 복사 (번역 필요):', key);
  }
});

// Write the result
fs.writeFileSync('src/locales/zh.json', JSON.stringify(newZh, null, 2), 'utf8');
console.log('\n✅ zh.json 재구성 완료!');
console.log('새로운 ZH 최상위 키:', Object.keys(newZh).length);

