// Add weightDistribution localization key
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
    ko: {
        'featureFlags.weightDistribution': '가중치 분배: 고정 {fixed}%, 자동 분배 {remaining}% ({autoCount}개)',
    },
    en: {
        'featureFlags.weightDistribution': 'Weight Distribution: Fixed {fixed}%, Auto {remaining}% ({autoCount} variants)',
    },
    zh: {
        'featureFlags.weightDistribution': '权重分配：固定 {fixed}%，自动 {remaining}%（{autoCount}个）',
    }
};

function addKeysToIni(filePath, keysToAdd) {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const existingKeys = new Set(lines.map(line => line.split('=')[0]));

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
