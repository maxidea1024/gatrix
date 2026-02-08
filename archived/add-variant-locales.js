// Add more missing featureFlags localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

// Additional missing keys
const additionalKeysKo = {
  'featureFlags.flagType': '플래그 타입',
  'featureFlags.segmentSelectorHelp': '미리 정의된 세그먼트를 선택하여 전략에 추가합니다.',
  'featureFlags.selectSegments': '세그먼트 선택...',
  'featureFlags.noSegments': '등록된 세그먼트가 없습니다.',
  'featureFlags.variantType': '변형 타입',
  'featureFlags.variantTypeHelp': '모든 변형에 적용되는 페이로드 타입입니다.',
  'featureFlags.variantTypes.string': '문자열',
  'featureFlags.variantTypes.json': 'JSON',
  'featureFlags.variantTypes.boolean': '불리언',
  'featureFlags.variantTypes.number': '숫자',
  'featureFlags.weight': '가중치',
};

const additionalKeysEn = {
  'featureFlags.flagType': 'Flag Type',
  'featureFlags.segmentSelectorHelp': 'Select predefined segments to add to this strategy.',
  'featureFlags.selectSegments': 'Select segments...',
  'featureFlags.noSegments': 'No segments available.',
  'featureFlags.variantType': 'Variant Type',
  'featureFlags.variantTypeHelp': 'The payload type applied to all variants.',
  'featureFlags.variantTypes.string': 'String',
  'featureFlags.variantTypes.json': 'JSON',
  'featureFlags.variantTypes.boolean': 'Boolean',
  'featureFlags.variantTypes.number': 'Number',
  'featureFlags.weight': 'Weight',
};

const additionalKeysZh = {
  'featureFlags.flagType': '标志类型',
  'featureFlags.segmentSelectorHelp': '选择预定义的细分群体添加到此策略。',
  'featureFlags.selectSegments': '选择细分群体...',
  'featureFlags.noSegments': '没有可用的细分群体。',
  'featureFlags.variantType': '变体类型',
  'featureFlags.variantTypeHelp': '应用于所有变体的负载类型。',
  'featureFlags.variantTypes.string': '字符串',
  'featureFlags.variantTypes.json': 'JSON',
  'featureFlags.variantTypes.boolean': '布尔值',
  'featureFlags.variantTypes.number': '数字',
  'featureFlags.weight': '权重',
};

function addKeysToIni(filePath, keys) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const existingKeys = new Set(lines.map((line) => line.split('=')[0]));

  let added = 0;
  for (const [key, value] of Object.entries(keys)) {
    if (!existingKeys.has(key)) {
      content += `\n${key}=${value}`;
      added++;
      console.log(`  + ${key}`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return added;
}

console.log('Adding additional localization keys...\n');

console.log('ko.ini:');
const koAdded = addKeysToIni(path.join(localesDir, 'ko.ini'), additionalKeysKo);
console.log(`  Total added: ${koAdded}\n`);

console.log('en.ini:');
const enAdded = addKeysToIni(path.join(localesDir, 'en.ini'), additionalKeysEn);
console.log(`  Total added: ${enAdded}\n`);

console.log('zh.ini:');
const zhAdded = addKeysToIni(path.join(localesDir, 'zh.ini'), additionalKeysZh);
console.log(`  Total added: ${zhAdded}\n`);

console.log('Done!');
