const fs = require('fs');

// Load both files
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ko = JSON.parse(fs.readFileSync('src/locales/ko.json', 'utf8'));

// Get all keys from EN
const enKeys = Object.keys(en);
const koKeys = Object.keys(ko);

console.log('EN keys:', enKeys.length);
console.log('KO keys:', koKeys.length);

// Find missing keys in KO
const missingKeys = enKeys.filter(k => !koKeys.includes(k));
console.log('\nMissing keys in KO:', missingKeys);

// Create new KO object with same key order as EN
const newKo = {};

enKeys.forEach(key => {
  if (ko[key]) {
    // Use existing KO translation
    newKo[key] = ko[key];
  } else {
    // Copy from EN (will need manual translation later)
    newKo[key] = en[key];
    console.log(`Copied "${key}" from EN (needs translation)`);
  }
});

// Write the fixed KO file
fs.writeFileSync('src/locales/ko.json', JSON.stringify(newKo, null, 2), 'utf8');

console.log('\n✅ Fixed ko.json - added', missingKeys.length, 'missing sections');
console.log('⚠️  These sections are in English and need Korean translation:', missingKeys.join(', '));

