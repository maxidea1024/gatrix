const fs = require('fs');

const content = fs.readFileSync('src/locales/zh.json', 'utf8');
const lines = content.split('\n');

const topLevelKeys = [];
let depth = 0;
let inObject = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Count braces
  for (let char of line) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }

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
        topLevelKeys.push({ key, line: i + 1 });
      }
    }
  }
}

console.log('=== 최상위 키 목록 (순서대로) ===');
const seen = {};
const duplicates = [];

topLevelKeys.forEach(({ key, line }) => {
  if (seen[key]) {
    duplicates.push({ key, firstLine: seen[key], duplicateLine: line });
    console.log('❌ 중복:', key, '(첫번째:', seen[key] + '줄, 중복:', line + '줄)');
  } else {
    seen[key] = line;
    console.log('✅', key, '(' + line + '줄)');
  }
});

console.log('\n=== 중복 키 요약 ===');
duplicates.forEach((d) =>
  console.log('중복:', d.key, '- 첫번째:', d.firstLine + '줄, 중복:', d.duplicateLine + '줄')
);
