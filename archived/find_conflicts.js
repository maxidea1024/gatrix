const fs = require('fs');

const files = [
  'packages/frontend/src/components/admin/ClientVersionForm.tsx',
  'packages/frontend/src/pages/admin/GameWorldsPage.tsx'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log(`\n=== ${file} ===`);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<<<<<<<') || lines[i].includes('>>>>>>>') || lines[i].includes('=======')) {
      console.log(`Line ${i+1}: ${lines[i]}`);
    }
  }
}
