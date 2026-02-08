// Add missing localization keys for constraint editor
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.selectValue': '값 선택',
    'featureFlags.enterValue': '값을 입력하세요',
  },
  en: {
    'featureFlags.selectValue': 'Select value',
    'featureFlags.enterValue': 'Enter value',
  },
  zh: {
    'featureFlags.selectValue': '选择值',
    'featureFlags.enterValue': '输入值',
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

console.log('Adding missing constraint editor keys...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
