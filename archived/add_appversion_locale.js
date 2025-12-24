const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';
const files = ['ko.json', 'en.json', 'zh.json'];

// Add appVersion and keep serverVersion for backward compatibility
const changes = {
    ko: {
        appVersion: '앱 버전',
    },
    en: {
        appVersion: 'App Version',
    },
    zh: {
        appVersion: '应用版本',
    }
};

files.forEach(file => {
    const lang = file.split('.')[0];
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);

    // Add appVersion to serverList
    if (parsed.serverList) {
        Object.entries(changes[lang]).forEach(([key, value]) => {
            parsed.serverList[key] = value;
        });
    }

    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n');
    console.log(`Updated ${file} with appVersion`);
});

console.log('Done!');
