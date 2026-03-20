// Find pages NOT using PageHeader that have colored icons in their headers
const fs = require('fs');
const path = require('path');

const d = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'pages');
const skip = ['auth', 'common'];

function findFiles(dir) {
  const results = [];
  try {
    fs.readdirSync(dir).forEach(item => {
      const fp = path.join(dir, item);
      if (fs.statSync(fp).isDirectory()) results.push(...findFiles(fp));
      else if (item.endsWith('Page.tsx')) results.push(fp);
    });
  } catch(e) {}
  return results;
}

const all = findFiles(d);

console.log('=== Non-PageHeader pages with colored header icons ===');
all.forEach(fp => {
  const c = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(d, fp);
  if (skip.some(s => rel.startsWith(s + path.sep))) return;
  if (c.includes('<PageHeader')) return;
  
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('variant="h4"') || lines[i].includes('variant="h5"')) {
      const block = lines.slice(Math.max(0, i - 5), Math.min(i + 10, lines.length)).join('\n');
      if (block.includes('Icon') && block.includes('color')) {
        console.log(`${rel}:${i + 1}`);
        // Show just the icon line
        const iconLines = block.split('\n').filter(l => l.includes('Icon') && l.includes('color'));
        iconLines.forEach(l => console.log(`  ${l.trim()}`));
      }
    }
  }
});

console.log('\n=== PageHeader pages - verify no icon color ===');
all.forEach(fp => {
  const c = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(d, fp);
  if (!c.includes('<PageHeader')) return;
  
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('icon={')) {
      // Check this line and next 2 for color
      const block = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
      if (block.includes('color')) {
        console.log(`${rel}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
});

console.log('\n=== All PageHeader pages count ===');
let count = 0;
all.forEach(fp => {
  if (fs.readFileSync(fp, 'utf8').includes('<PageHeader')) count++;
});
console.log(`Total pages using PageHeader: ${count}`);
