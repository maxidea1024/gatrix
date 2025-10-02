const fs = require('fs');

// Load zh.json
const zh = JSON.parse(fs.readFileSync('src/locales/zh.json', 'utf8'));

console.log('=== 수정 전 ===');
console.log('최상위 키 개수:', Object.keys(zh).length);
console.log('common 안의 키 개수:', Object.keys(zh.common || {}).length);

// Check if common has nested sections that should be at top level
const sectionsToMove = ['profile', 'roles', 'settings', 'sidebar', 'signUpPrompt', 'status', 'tags', 'ipWhitelist', 'landing', 'maintenanceMessage', 'platformDefaults', 'multiLanguageMessage'];

const newZh = {};

// First, copy all top-level keys except common
Object.keys(zh).forEach(key => {
  if (key !== 'common') {
    newZh[key] = zh[key];
  }
});

// Then, handle common section
if (zh.common) {
  const newCommon = {};
  
  Object.keys(zh.common).forEach(key => {
    if (sectionsToMove.includes(key)) {
      // Move to top level
      newZh[key] = zh.common[key];
      console.log('✅ 최상위로 이동:', key);
    } else {
      // Keep in common
      newCommon[key] = zh.common[key];
    }
  });
  
  newZh.common = newCommon;
}

console.log('\n=== 수정 후 ===');
console.log('최상위 키 개수:', Object.keys(newZh).length);
console.log('common 안의 키 개수:', Object.keys(newZh.common || {}).length);

// Write the result
fs.writeFileSync('src/locales/zh.json', JSON.stringify(newZh, null, 2), 'utf8');
console.log('\n✅ zh.json 구조 수정 완료!');

