// Add user-friendly operator labels
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
    ko: {
        'featureFlags.op.equals': '같음',
        'featureFlags.op.notEquals': '같지 않음',
        'featureFlags.op.contains': '포함',
        'featureFlags.op.startsWith': '시작',
        'featureFlags.op.endsWith': '끝',
        'featureFlags.op.in': '중 하나',
        'featureFlags.op.notIn': '중에 없음',
        'featureFlags.op.greaterThan': '초과',
        'featureFlags.op.greaterThanOrEqual': '이상',
        'featureFlags.op.lessThan': '미만',
        'featureFlags.op.lessThanOrEqual': '이하',
        'featureFlags.op.is': '이면',
        'featureFlags.op.after': '이후',
        'featureFlags.op.afterOrEqual': '이후(포함)',
        'featureFlags.op.before': '이전',
        'featureFlags.op.beforeOrEqual': '이전(포함)',
    },
    en: {
        'featureFlags.op.equals': 'equals',
        'featureFlags.op.notEquals': 'not equals',
        'featureFlags.op.contains': 'contains',
        'featureFlags.op.startsWith': 'starts with',
        'featureFlags.op.endsWith': 'ends with',
        'featureFlags.op.in': 'is one of',
        'featureFlags.op.notIn': 'is not one of',
        'featureFlags.op.greaterThan': 'greater than',
        'featureFlags.op.greaterThanOrEqual': 'at least',
        'featureFlags.op.lessThan': 'less than',
        'featureFlags.op.lessThanOrEqual': 'at most',
        'featureFlags.op.is': 'is',
        'featureFlags.op.after': 'after',
        'featureFlags.op.afterOrEqual': 'on or after',
        'featureFlags.op.before': 'before',
        'featureFlags.op.beforeOrEqual': 'on or before',
    },
    zh: {
        'featureFlags.op.equals': '等于',
        'featureFlags.op.notEquals': '不等于',
        'featureFlags.op.contains': '包含',
        'featureFlags.op.startsWith': '开头是',
        'featureFlags.op.endsWith': '结尾是',
        'featureFlags.op.in': '属于',
        'featureFlags.op.notIn': '不属于',
        'featureFlags.op.greaterThan': '大于',
        'featureFlags.op.greaterThanOrEqual': '大于等于',
        'featureFlags.op.lessThan': '小于',
        'featureFlags.op.lessThanOrEqual': '小于等于',
        'featureFlags.op.is': '是',
        'featureFlags.op.after': '之后',
        'featureFlags.op.afterOrEqual': '当天或之后',
        'featureFlags.op.before': '之前',
        'featureFlags.op.beforeOrEqual': '当天或之前',
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

console.log('Adding user-friendly operator labels...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
