const fs = require('fs');

// Load all locale files
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ko = JSON.parse(fs.readFileSync('src/locales/ko.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('src/locales/zh.json', 'utf8'));

// Function to get all keys recursively
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

const enKeys = getAllKeys(en).sort();
const koKeys = getAllKeys(ko).sort();
const zhKeys = getAllKeys(zh).sort();

console.log('=== 키 개수 비교 ===');
console.log('EN 키 개수:', enKeys.length);
console.log('KO 키 개수:', koKeys.length);
console.log('ZH 키 개수:', zhKeys.length);

// Find missing keys
const enSet = new Set(enKeys);
const koSet = new Set(koKeys);
const zhSet = new Set(zhKeys);

const missingInKo = enKeys.filter(k => !koSet.has(k));
const missingInZh = enKeys.filter(k => !zhSet.has(k));
const extraInKo = koKeys.filter(k => !enSet.has(k));
const extraInZh = zhKeys.filter(k => !enSet.has(k));

if (missingInKo.length > 0) {
  console.log('\n❌ KO에 누락된 키 (' + missingInKo.length + '개):');
  missingInKo.slice(0, 20).forEach(k => console.log('  -', k));
  if (missingInKo.length > 20) {
    console.log('  ... 외 ' + (missingInKo.length - 20) + '개 더');
  }
}

if (missingInZh.length > 0) {
  console.log('\n❌ ZH에 누락된 키 (' + missingInZh.length + '개):');
  missingInZh.slice(0, 20).forEach(k => console.log('  -', k));
  if (missingInZh.length > 20) {
    console.log('  ... 외 ' + (missingInZh.length - 20) + '개 더');
  }
}

if (extraInKo.length > 0) {
  console.log('\n⚠️  KO에만 있는 키 (' + extraInKo.length + '개):');
  extraInKo.slice(0, 20).forEach(k => console.log('  -', k));
  if (extraInKo.length > 20) {
    console.log('  ... 외 ' + (extraInKo.length - 20) + '개 더');
  }
}

if (extraInZh.length > 0) {
  console.log('\n⚠️  ZH에만 있는 키 (' + extraInZh.length + '개):');
  extraInZh.slice(0, 20).forEach(k => console.log('  -', k));
  if (extraInZh.length > 20) {
    console.log('  ... 외 ' + (extraInZh.length - 20) + '개 더');
  }
}

if (missingInKo.length === 0 && missingInZh.length === 0 && extraInKo.length === 0 && extraInZh.length === 0) {
  console.log('\n✅ 모든 로케일 파일의 키 구조가 동일합니다!');
} else {
  console.log('\n❌ 로케일 파일 간 키 불일치가 발견되었습니다.');
}

