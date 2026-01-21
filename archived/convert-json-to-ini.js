// JSON to INI-style converter for localization files
// Flattens nested objects to full path keys (e.g., common.save=저장)

const fs = require('fs');
const path = require('path');

// Flatten nested object to dot-notation keys
function flatten(obj, prefix = '') {
    const result = {};
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(result, flatten(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    }
    return result;
}

const files = ['ko', 'en', 'zh'];
const localesDir = 'packages/frontend/src/locales';

files.forEach(lang => {
    const jsonPath = path.join(localesDir, `${lang}.json`);
    const iniPath = path.join(localesDir, `${lang}.ini`);

    console.log(`\n=== Converting ${lang} ===`);

    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Flatten nested objects
    const flattened = flatten(json);

    // Sort keys for easier management
    const sortedKeys = Object.keys(flattened).sort();

    console.log(`  Total keys after flattening: ${sortedKeys.length}`);

    // Check for duplicates (shouldn't happen after flattening, but just in case)
    const seen = new Set();
    const duplicates = [];
    sortedKeys.forEach(key => {
        if (seen.has(key)) duplicates.push(key);
        seen.add(key);
    });
    if (duplicates.length > 0) {
        console.log(`  WARNING: ${duplicates.length} duplicate keys found!`);
        duplicates.forEach(d => console.log(`    - ${d}`));
    }

    // Convert to INI format
    const iniContent = sortedKeys.map(key => `${key}=${flattened[key]}`).join('\n');

    fs.writeFileSync(iniPath, iniContent, 'utf8');
    console.log(`  Created ${iniPath}`);
});

console.log('\n\nDone! INI files created with flattened keys.');
