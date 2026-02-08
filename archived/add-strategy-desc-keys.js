// Add strategy description localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.strategiesDescriptionEmpty':
      '조건 또는 세그먼트가 하나도 없습니다. 기본 전략만 적용됩니다. 특정 사용자를 타게팅하려면 조건이나 세그먼트를 설정하세요.',
    'featureFlags.strategiesDescriptionWithCount':
      '세그먼트 {{segmentCount}}개, 조건 {{constraintCount}}개가 설정되어 있습니다.',
  },
  en: {
    'featureFlags.strategiesDescriptionEmpty':
      'No conditions or segments configured. Only the default strategy will be applied. Add conditions or segments to target specific users.',
    'featureFlags.strategiesDescriptionWithCount':
      '{{segmentCount}} segment(s) and {{constraintCount}} constraint(s) configured.',
  },
  zh: {
    'featureFlags.strategiesDescriptionEmpty':
      '没有配置条件或分段。仅应用默认策略。添加条件或分段以定位特定用户。',
    'featureFlags.strategiesDescriptionWithCount':
      '已配置 {{segmentCount}} 个分段和 {{constraintCount}} 个条件。',
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
