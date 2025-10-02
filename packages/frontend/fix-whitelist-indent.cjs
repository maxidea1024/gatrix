const fs = require('fs');

const content = fs.readFileSync('src/locales/ko.json', 'utf8');
const lines = content.split('\n');

// 843번째 줄부터 938번째 줄까지 2칸 줄이기
for (let i = 842; i < 938; i++) {
  if (lines[i].startsWith('      ')) {
    lines[i] = lines[i].substring(2);
  }
}

fs.writeFileSync('src/locales/ko.json', lines.join('\n'), 'utf8');
console.log('✅ whitelist 섹션 들여쓰기 수정 완료');

