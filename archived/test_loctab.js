const fs = require('fs');

// Simulate the parseCSVLine function
function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  return fields;
}

const content = fs.readFileSync('packages/backend/cms/locdata/locdata', 'utf8');
const lines = content.split(/\r?\n/);
console.log('Total lines:', lines.length);

// Find all lines with 나(Na) or 나(na)
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.includes('나(Na)') || line.includes('나(na)')) {
    console.log('Line', i + 1 + ':', JSON.stringify(line.substring(0, 80)));
  }
}

