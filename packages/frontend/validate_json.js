import fs from 'fs';

const content = fs.readFileSync('./src/locales/en.json', 'utf8');

try {
  JSON.parse(content);
  console.log('JSON is valid!');
} catch (error) {
  console.error('JSON validation error:', error.message);

  if (error.message.includes('line')) {
    const lines = content.split('\n');
    const lineMatch = error.message.match(/line (\d+)/);
    if (lineMatch) {
      const lineNum = parseInt(lineMatch[1]);
      console.log(`\nContext around line ${lineNum}:`);
      for (let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 3); i++) {
        const marker = i === lineNum - 1 ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
      }
    }
  }
}
