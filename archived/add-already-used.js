// Add alreadyUsed localization key
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: { 'featureFlags.alreadyUsed': '이미 사용 중' },
  en: { 'featureFlags.alreadyUsed': 'Already in use' },
  zh: { 'featureFlags.alreadyUsed': '已在使用中' },
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

addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('Done!');
