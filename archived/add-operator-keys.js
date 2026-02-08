// Add operator and segment condition localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.operators.contains': '포함',
    'featureFlags.operators.startsWith': '시작',
    'featureFlags.operators.endsWith': '끝남',
    'featureFlags.operators.before': '이전',
    'featureFlags.operators.after': '이후',
    'featureFlags.segmentConditions': '세그먼트 조건',
  },
  en: {
    'featureFlags.operators.contains': 'contains',
    'featureFlags.operators.startsWith': 'starts with',
    'featureFlags.operators.endsWith': 'ends with',
    'featureFlags.operators.before': 'before',
    'featureFlags.operators.after': 'after',
    'featureFlags.segmentConditions': 'Segment Conditions',
  },
  zh: {
    'featureFlags.operators.contains': '包含',
    'featureFlags.operators.startsWith': '开头是',
    'featureFlags.operators.endsWith': '结尾是',
    'featureFlags.operators.before': '之前',
    'featureFlags.operators.after': '之后',
    'featureFlags.segmentConditions': '细分群体条件',
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

console.log('Adding operator and segment condition keys...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
