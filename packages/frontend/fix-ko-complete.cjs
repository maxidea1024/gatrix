const fs = require('fs');

// Load files
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const koOriginal = fs.readFileSync('src/locales/ko.json', 'utf8');

// Extract Korean sections from the original file
function extractSection(text, sectionName) {
  const start = text.indexOf(`"${sectionName}": {`);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start + `"${sectionName}": {`.length - 1; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return null;

  const section = text.substring(start, end + 1);
  try {
    const parsed = JSON.parse('{' + section + '}');
    return parsed[sectionName];
  } catch (e) {
    console.log(`⚠️  Could not parse ${sectionName}:`, e.message);
    return null;
  }
}

console.log('Extracting Korean translations from original file...');

// Extract Korean sections
const gameWorldsKo = extractSection(koOriginal, 'gameWorlds');
const usersKo = extractSection(koOriginal, 'users');
const maintenanceKo = extractSection(koOriginal, 'maintenance');
const schedulerKo = extractSection(koOriginal, 'scheduler');

console.log('gameWorlds:', gameWorldsKo ? '✅ Found' : '❌ Not found');
console.log('users:', usersKo ? '✅ Found' : '❌ Not found');
console.log('maintenance:', maintenanceKo ? '✅ Found' : '❌ Not found');
console.log('scheduler:', schedulerKo ? '✅ Found' : '❌ Not found');

// Parse the original ko.json (it will fail but we'll use what we can)
let ko = {};
try {
  ko = JSON.parse(koOriginal);
} catch (e) {
  console.log('⚠️  Original ko.json has JSON errors, using extracted sections');
}

// Create new KO object with same key order as EN
const newKo = {};

Object.keys(en).forEach((key) => {
  if (ko[key]) {
    // Use existing KO translation
    newKo[key] = ko[key];
  } else if (key === 'gameWorlds' && gameWorldsKo) {
    // Use extracted Korean gameWorlds
    newKo[key] = gameWorldsKo;
    console.log(`✅ Using Korean translation for "${key}"`);
  } else if (key === 'users' && usersKo) {
    // Use extracted Korean users
    newKo[key] = usersKo;
    console.log(`✅ Using Korean translation for "${key}"`);
  } else if (key === 'maintenance' && maintenanceKo) {
    // Use extracted Korean maintenance
    newKo[key] = maintenanceKo;
    console.log(`✅ Using Korean translation for "${key}"`);
  } else if (key === 'scheduler' && schedulerKo) {
    // Use extracted Korean scheduler
    newKo[key] = schedulerKo;
    console.log(`✅ Using Korean translation for "${key}"`);
  } else {
    // Copy from EN (will need manual translation later)
    newKo[key] = en[key];
    console.log(`⚠️  Copied "${key}" from EN (needs translation)`);
  }
});

// Write the fixed KO file
fs.writeFileSync('src/locales/ko.json', JSON.stringify(newKo, null, 2), 'utf8');

console.log('\n✅ Fixed ko.json successfully!');
console.log('Total keys:', Object.keys(newKo).length);
