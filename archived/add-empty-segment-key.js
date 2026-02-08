// Add empty segment warning key
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.emptySegmentWarning':
      '세그먼트 "{{name}}"에 조건이 없어 모든 사용자에게 적용됩니다.',
  },
  en: {
    'featureFlags.emptySegmentWarning':
      'Segment "{{name}}" has no constraints and will apply to all users.',
  },
  zh: {
    'featureFlags.emptySegmentWarning': '细分群体 "{{name}}" 没有约束条件，将应用于所有用户。',
  },
};

function addKeysToIni(filePath, keysToAdd) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const existingKeys = new Set(lines.map((line) => line.split('=')[0]));

  for (const [key, value] of Object.entries(keysToAdd)) {
    if (!existingKeys.has(key)) {
      content += `\n${key}=${value}`;
      console.log(`Added: ${key}`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Adding empty segment warning keys...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
