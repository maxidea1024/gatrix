// Add variantWeight and flagVariants localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.variantWeight': '가중치',
    'featureFlags.flagVariants': '플래그 변형',
  },
  en: {
    'featureFlags.variantWeight': 'Variant weight',
    'featureFlags.flagVariants': 'Flag variants',
  },
  zh: {
    'featureFlags.variantWeight': '变体权重',
    'featureFlags.flagVariants': '标志变体',
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

addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('Done!');
