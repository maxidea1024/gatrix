const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  const results = [];

  function search(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        search(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.match(/t\([`'"]admin\.crashes\.[^)]+\)/g);

        if (matches) {
          results.push({
            file: fullPath.replace(/\\/g, '/'),
            matches: matches,
          });
        }
      }
    });
  }

  search(dir);
  return results;
}

const results = findFiles('src');

if (results.length === 0) {
  console.log('✅ admin.crashes. 패턴을 사용하는 파일이 없습니다.');
} else {
  console.log('❌ admin.crashes. 패턴을 사용하는 파일:');
  results.forEach((r) => {
    console.log('\n파일:', r.file);
    r.matches.forEach((m) => console.log('  -', m));
  });
}
