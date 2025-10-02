const fs = require('fs');

// Load all locale files
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ko = JSON.parse(fs.readFileSync('src/locales/ko.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('src/locales/zh.json', 'utf8'));

// Function to get value from nested object using dot notation
function getValue(obj, path) {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

// Function to set value in nested object using dot notation
function setValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = obj;
  
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
}

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

// Function to rebuild object with same structure as reference
function rebuildWithStructure(reference, source, fallback) {
  const result = {};
  
  function copyStructure(refObj, srcObj, fbObj, targetObj) {
    for (const key in refObj) {
      if (typeof refObj[key] === 'object' && refObj[key] !== null && !Array.isArray(refObj[key])) {
        targetObj[key] = {};
        copyStructure(
          refObj[key],
          srcObj && srcObj[key] ? srcObj[key] : {},
          fbObj && fbObj[key] ? fbObj[key] : {},
          targetObj[key]
        );
      } else {
        // Try to get value from source, then fallback, then reference
        if (srcObj && key in srcObj) {
          targetObj[key] = srcObj[key];
        } else if (fbObj && key in fbObj) {
          targetObj[key] = fbObj[key];
        } else {
          targetObj[key] = refObj[key];
        }
      }
    }
  }
  
  copyStructure(reference, source, fallback, result);
  return result;
}

console.log('EN을 기준으로 KO와 ZH를 재구성합니다...\n');

// Rebuild KO and ZH with EN structure
const newKo = rebuildWithStructure(en, ko, en);
const newZh = rebuildWithStructure(en, zh, en);

// Save backup
fs.writeFileSync('src/locales/ko.json.backup', JSON.stringify(ko, null, 2), 'utf8');
fs.writeFileSync('src/locales/zh.json.backup', JSON.stringify(zh, null, 2), 'utf8');

// Save new files
fs.writeFileSync('src/locales/ko.json', JSON.stringify(newKo, null, 2), 'utf8');
fs.writeFileSync('src/locales/zh.json', JSON.stringify(newZh, null, 2), 'utf8');

// Validate
const enKeys = getAllKeys(en).sort();
const newKoKeys = getAllKeys(newKo).sort();
const newZhKeys = getAllKeys(newZh).sort();

console.log('=== 재구성 완료 ===');
console.log('EN 키 개수:', enKeys.length);
console.log('KO 키 개수:', newKoKeys.length);
console.log('ZH 키 개수:', newZhKeys.length);

if (enKeys.length === newKoKeys.length && enKeys.length === newZhKeys.length) {
  console.log('\n✅ 모든 로케일 파일의 키 개수가 동일합니다!');
  
  // Check if all keys match
  const allMatch = enKeys.every((key, i) => key === newKoKeys[i] && key === newZhKeys[i]);
  if (allMatch) {
    console.log('✅ 모든 키가 완벽하게 일치합니다!');
  } else {
    console.log('⚠️  키 개수는 같지만 순서나 이름이 다릅니다.');
  }
} else {
  console.log('\n❌ 키 개수가 여전히 다릅니다.');
}

console.log('\n백업 파일:');
console.log('  - src/locales/ko.json.backup');
console.log('  - src/locales/zh.json.backup');

