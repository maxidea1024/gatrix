// Add missing localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.fieldRequired': '필드를 선택하세요',
    'featureFlags.valueRequired': '값을 입력하세요',
    'featureFlags.constraintValues': '값 목록',
    'featureFlags.legalValuesPlaceholder': '허용 값 입력 후 Enter',
    'featureFlags.selectValue': '값 선택',
    'featureFlags.enterValue': '값을 입력하세요',
  },
  en: {
    'featureFlags.fieldRequired': 'Please select a field',
    'featureFlags.valueRequired': 'Please enter a value',
    'featureFlags.constraintValues': 'Values',
    'featureFlags.legalValuesPlaceholder': 'Enter values and press Enter',
    'featureFlags.selectValue': 'Select value',
    'featureFlags.enterValue': 'Enter value',
  },
  zh: {
    'featureFlags.fieldRequired': '请选择字段',
    'featureFlags.valueRequired': '请输入值',
    'featureFlags.constraintValues': '值列表',
    'featureFlags.legalValuesPlaceholder': '输入值后按回车',
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
    } else {
      console.log(`Exists: ${key}`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Adding missing keys...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
