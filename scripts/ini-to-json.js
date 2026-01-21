// INI to JSON converter for i18next
// Run this before build: node scripts/ini-to-json.js

const fs = require('fs');
const path = require('path');

const files = ['ko', 'en', 'zh'];
const localesDir = path.join(__dirname, '../packages/frontend/src/locales');

// Parse INI format (key=value per line)
function parseIni(content) {
    const result = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1);

        // Convert dot notation to nested object
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }

    return result;
}

console.log('Converting INI files to JSON for i18next...\n');

files.forEach(lang => {
    const iniPath = path.join(localesDir, `${lang}.ini`);
    const jsonPath = path.join(localesDir, `${lang}.json`);

    if (!fs.existsSync(iniPath)) {
        console.log(`  SKIP: ${iniPath} not found`);
        return;
    }

    const iniContent = fs.readFileSync(iniPath, 'utf8');
    const json = parseIni(iniContent);

    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');
    console.log(`  ${lang}.ini -> ${lang}.json (${Object.keys(json).length} top-level keys)`);
});

console.log('\nDone! JSON files updated from INI source.');
