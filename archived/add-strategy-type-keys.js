// Add strategy types localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
    ko: {
        'featureFlags.strategies.default.title': '기본',
        'featureFlags.strategies.default.desc': '모든 사용자에게 활성화',
        'featureFlags.strategies.userWithId.title': '사용자 ID',
        'featureFlags.strategies.userWithId.desc': '특정 사용자에게만 활성화',
        'featureFlags.strategies.gradualRolloutRandom.title': '점진적 롤아웃',
        'featureFlags.strategies.gradualRolloutRandom.desc': '일정 비율의 사용자에게 활성화',
        'featureFlags.strategies.gradualRolloutUserId.title': '점진적 롤아웃 (고정)',
        'featureFlags.strategies.gradualRolloutUserId.desc': '사용자 ID 기반 일관된 롤아웃',
        'featureFlags.strategies.flexibleRollout.title': '유연한 롤아웃',
        'featureFlags.strategies.flexibleRollout.desc': '고급 롤아웃 (고정 기준 설정 가능)',
        'featureFlags.strategies.remoteAddress.title': 'IP 주소',
        'featureFlags.strategies.remoteAddress.desc': '특정 IP에서만 활성화',
        'featureFlags.strategies.applicationHostname.title': '호스트네임',
        'featureFlags.strategies.applicationHostname.desc': '특정 호스트에서만 활성화',
    },
    en: {
        'featureFlags.strategies.default.title': 'Standard',
        'featureFlags.strategies.default.desc': 'Enable for all users',
        'featureFlags.strategies.userWithId.title': 'User IDs',
        'featureFlags.strategies.userWithId.desc': 'Enable for specific users',
        'featureFlags.strategies.gradualRolloutRandom.title': 'Gradual Rollout',
        'featureFlags.strategies.gradualRolloutRandom.desc': 'Enable for a percentage of users',
        'featureFlags.strategies.gradualRolloutUserId.title': 'Gradual Rollout (Sticky)',
        'featureFlags.strategies.gradualRolloutUserId.desc': 'Consistent rollout by user ID',
        'featureFlags.strategies.flexibleRollout.title': 'Flexible Rollout',
        'featureFlags.strategies.flexibleRollout.desc': 'Advanced rollout with stickiness',
        'featureFlags.strategies.remoteAddress.title': 'IP Address',
        'featureFlags.strategies.remoteAddress.desc': 'Enable for specific IPs',
        'featureFlags.strategies.applicationHostname.title': 'Hostname',
        'featureFlags.strategies.applicationHostname.desc': 'Enable for specific hosts',
    },
    zh: {
        'featureFlags.strategies.default.title': '标准',
        'featureFlags.strategies.default.desc': '对所有用户启用',
        'featureFlags.strategies.userWithId.title': '用户ID',
        'featureFlags.strategies.userWithId.desc': '仅对特定用户启用',
        'featureFlags.strategies.gradualRolloutRandom.title': '渐进式推出',
        'featureFlags.strategies.gradualRolloutRandom.desc': '对一定比例的用户启用',
        'featureFlags.strategies.gradualRolloutUserId.title': '渐进式推出 (固定)',
        'featureFlags.strategies.gradualRolloutUserId.desc': '基于用户ID的一致推出',
        'featureFlags.strategies.flexibleRollout.title': '灵活推出',
        'featureFlags.strategies.flexibleRollout.desc': '带粘性的高级推出',
        'featureFlags.strategies.remoteAddress.title': 'IP地址',
        'featureFlags.strategies.remoteAddress.desc': '仅对特定IP启用',
        'featureFlags.strategies.applicationHostname.title': '主机名',
        'featureFlags.strategies.applicationHostname.desc': '仅对特定主机启用',
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

console.log('Adding strategy type localization keys...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
