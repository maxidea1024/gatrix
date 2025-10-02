const fs = require('fs');

// Read the original ko.json file as text
const koText = fs.readFileSync('src/locales/ko.json', 'utf8');

// Find the gameWorlds section (it's nested inside jobs)
// We need to extract it manually since JSON.parse fails

// Find where "gameWorlds" starts
const gameWorldsStart = koText.indexOf('"gameWorlds": {');
if (gameWorldsStart === -1) {
  console.log('❌ gameWorlds section not found');
  process.exit(1);
}

console.log('✅ Found gameWorlds at position:', gameWorldsStart);

// Find the matching closing brace for gameWorlds
// This is tricky - we need to count braces
let depth = 0;
let inString = false;
let escape = false;
let gameWorldsEnd = -1;

for (let i = gameWorldsStart + '"gameWorlds": {'.length - 1; i < koText.length; i++) {
  const char = koText[i];
  
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
      gameWorldsEnd = i;
      break;
    }
  }
}

if (gameWorldsEnd === -1) {
  console.log('❌ Could not find end of gameWorlds section');
  process.exit(1);
}

console.log('✅ Found gameWorlds end at position:', gameWorldsEnd);

// Extract the gameWorlds section
const gameWorldsSection = koText.substring(gameWorldsStart, gameWorldsEnd + 1);

// Save it to a temporary file
fs.writeFileSync('gameWorlds-korean.json', gameWorldsSection, 'utf8');

console.log('✅ Extracted gameWorlds section to gameWorlds-korean.json');
console.log('Length:', gameWorldsSection.length, 'characters');

// Try to parse it as JSON to verify
try {
  const parsed = JSON.parse('{' + gameWorldsSection + '}');
  console.log('✅ Successfully parsed as JSON');
  console.log('Keys in gameWorlds:', Object.keys(parsed.gameWorlds).length);
} catch (e) {
  console.log('⚠️  Could not parse as standalone JSON (this is expected if nested)');
}

