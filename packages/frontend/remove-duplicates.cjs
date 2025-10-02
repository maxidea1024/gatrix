const fs = require('fs');

const content = fs.readFileSync('src/locales/ko.json', 'utf8');
const lines = content.split('\n');

// Find all top-level keys with their line numbers
const topLevelKeys = [];
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count braces
  for (let char of line) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }
  
  const trimmed = line.trim();
  
  // Check if this is a top-level key (depth 1 after opening brace)
  if (trimmed.match(/^"([^"]+)"\s*:\s*\{/)) {
    const match = trimmed.match(/^"([^"]+)"/);
    if (match) {
      const key = match[1];
      // Calculate depth before this line
      let depthBefore = 0;
      for (let j = 0; j < i; j++) {
        for (let char of lines[j]) {
          if (char === '{') depthBefore++;
          if (char === '}') depthBefore--;
        }
      }
      if (depthBefore === 1) {
        topLevelKeys.push({ key, startLine: i });
      }
    }
  }
}

// Find duplicates
const seen = {};
const duplicates = [];

topLevelKeys.forEach(({ key, startLine }) => {
  if (seen[key]) {
    duplicates.push({ key, firstLine: seen[key], duplicateLine: startLine });
  } else {
    seen[key] = startLine;
  }
});

console.log('=== 중복 키 발견 ===');
duplicates.forEach(d => console.log('중복:', d.key, '- 첫번째:', (d.firstLine + 1) + '줄, 중복:', (d.duplicateLine + 1) + '줄'));

// Find the end line of each duplicate section
const duplicateSections = [];

duplicates.forEach(({ key, duplicateLine }) => {
  let depth = 0;
  let endLine = duplicateLine;
  
  for (let i = duplicateLine; i < lines.length; i++) {
    const line = lines[i];
    
    for (let char of line) {
      if (char === '{') depth++;
      if (char === '}') depth--;
    }
    
    if (depth === 0 && i > duplicateLine) {
      endLine = i;
      break;
    }
  }
  
  duplicateSections.push({ key, startLine: duplicateLine, endLine });
  console.log('제거할 섹션:', key, '(' + (duplicateLine + 1) + '-' + (endLine + 1) + '줄)');
});

// Remove duplicate sections (from bottom to top to preserve line numbers)
duplicateSections.sort((a, b) => b.startLine - a.startLine);

duplicateSections.forEach(({ key, startLine, endLine }) => {
  console.log('제거 중:', key, '(' + (startLine + 1) + '-' + (endLine + 1) + '줄)');
  lines.splice(startLine, endLine - startLine + 1);
  
  // Also remove the comma from the previous line if it exists
  if (startLine > 0 && lines[startLine - 1].trim().endsWith(',')) {
    lines[startLine - 1] = lines[startLine - 1].replace(/,\s*$/, '');
  }
});

// Write the result
fs.writeFileSync('src/locales/ko.json', lines.join('\n'), 'utf8');
console.log('\n✅ 중복 섹션 제거 완료!');

