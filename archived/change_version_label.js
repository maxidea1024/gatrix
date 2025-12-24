const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';
const files = ['ko.json', 'en.json', 'zh.json'];

// Change serverVersion label to appVersion
const changes = {
    ko: {
        serverVersion: '앱 버전',
    },
    en: {
        serverVersion: 'App Version',
    },
    zh: {
        serverVersion: '应用版本',
    }
};

files.forEach(file => {
    const lang = file.split('.')[0];
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);

    // Update serverList entries
    if (parsed.serverList) {
        Object.entries(changes[lang]).forEach(([key, value]) => {
            if (parsed.serverList[key] !== undefined) {
                parsed.serverList[key] = value;
            }
        });
    }

    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n');
    console.log(`Updated ${file}`);
});

console.log('Done!');
