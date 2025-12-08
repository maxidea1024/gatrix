const fs = require('fs');

const str = fs.readFileSync('packages/backend/cms/locdata/locdata', 'utf8');
console.log('String length:', str.length);

// Test different split patterns
const lines1 = str.split('\n');
console.log('Lines after split by \\n:', lines1.length);

const lines2 = str.split('\r\n');
console.log('Lines after split by \\r\\n:', lines2.length);

const lines3 = str.split(/\r?\n/);
console.log('Lines after split by /\\r?\\n/:', lines3.length);

// Search for 나(Na) in lines3
for (let i = 0; i < lines3.length; i++) {
  if (lines3[i].includes('나(Na)')) {
    console.log('Found 나(Na) on line', i + 1);
    console.log('Line content:', JSON.stringify(lines3[i].substring(0, 100)));
    break;
  }
}

