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

const line = '",나(Na)",나,,罗,../cms/textset/Character.textset:1376,,,';
const fields = parseCSVLine(line);
console.log('fields:', fields);
console.log('field[0]:', fields[0]);
console.log('field[3]:', fields[3]);

// Simulate the key processing
let key = fields[0];
console.log('key before processing:', JSON.stringify(key));
if (key && key.startsWith(',')) {
  key = key.substring(1);
}
console.log('key after comma strip:', JSON.stringify(key));
// Trim
if (key) {
  key = key.trim();
}
console.log('key after trim:', JSON.stringify(key));
// Remove @ comment suffix
if (key && key.includes('@')) {
  key = key.substring(0, key.indexOf('@'));
}
console.log('key after @ strip:', JSON.stringify(key));
// Unescape backslash
if (key && key.includes('\\')) {
  key = key.replace(/\\(.)/g, '$1');
}
console.log('final key:', JSON.stringify(key));

