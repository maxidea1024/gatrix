// Fix weightDistribution localization key format
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

// Read each locale file and fix the key
const files = [
    { file: 'ko.ini', value: '가중치 분배: 고정 {{fixed}}%, 자동 분배 {{remaining}}% ({{autoCount}}개)' },
    { file: 'en.ini', value: 'Weight Distribution: Fixed {{fixed}}%, Auto {{remaining}}% ({{autoCount}} variants)' },
    { file: 'zh.ini', value: '权重分配：固定 {{fixed}}%，自动 {{remaining}}%（{{autoCount}}个）' }
];

for (const { file, value } of files) {
    const filePath = path.join(localesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove old key with single braces if exists
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => !line.startsWith('featureFlags.weightDistribution='));

    // Add correct key
    filteredLines.push(`featureFlags.weightDistribution=${value}`);

    fs.writeFileSync(filePath, filteredLines.join('\n'), 'utf8');
    console.log(`Fixed: ${file}`);
}

console.log('Done!');
