const fs = require('fs');
const path = require('path');

// 수정할 파일들
const filesToFix = [
  'src/routes/ipWhitelist.ts',
  'src/routes/jobs.ts',
  'src/routes/messageTemplates.ts',
  'src/routes/tags.ts',
  'src/routes/whitelist.ts',
];

filesToFix.forEach((filePath) => {
  const fullPath = path.join(__dirname, filePath);

  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');

    // getDetails를 getNewValues로 변경
    content = content.replace(/getDetails:/g, 'getNewValues:');

    // 간단한 getDetails 패턴들을 getNewValues로 변경
    content = content.replace(/getNewValues:\s*\(req[^)]*\)\s*=>\s*\(\{[^}]*\}\)/g, (match) => {
      // req.body가 포함된 경우 간단히 req.body로 변경
      if (match.includes('req.body')) {
        return 'getNewValues: (req) => req.body';
      }
      return match;
    });

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All files fixed!');
