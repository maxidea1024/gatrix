// Add variant field help text localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.variantNameFieldHelp': '영문 소문자, 숫자, 하이픈만 사용 가능합니다',
    'featureFlags.payloadHelp': '이 변형이 선택되었을 때 반환될 값입니다',
  },
  en: {
    'featureFlags.variantNameFieldHelp': 'Only lowercase letters, numbers and hyphens are allowed',
    'featureFlags.payloadHelp': 'The value that will be returned when this variant is selected',
  },
  zh: {
    'featureFlags.variantNameFieldHelp': '只允许使用小写字母、数字和连字符',
    'featureFlags.payloadHelp': '选择此变体时将返回的值',
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
