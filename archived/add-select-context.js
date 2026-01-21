// Add selectContextField localization key
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
    ko: {
        'featureFlags.selectContextField': '컨텍스트 필드 선택',
    },
    en: {
        'featureFlags.selectContextField': 'Select context field',
    },
    zh: {
        'featureFlags.selectContextField': '选择上下文字段',
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
