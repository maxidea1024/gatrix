const fs = require('fs');

const content = fs.readFileSync('src/locales/ko.json', 'utf8');
const lines = content.split('\n');

// 288번째 줄부터 839번째 줄까지 2칸 줄이기
for (let i = 287; i < 839; i++) {
  if (lines[i].startsWith('    ')) {
    lines[i] = lines[i].substring(2);
  }
}

// 840번째 줄의 잘못된 `},` 제거
if (lines[839].trim() === '},') {
  lines.splice(839, 1);
}

fs.writeFileSync('src/locales/ko.json', lines.join('\n'), 'utf8');
console.log('✅ 모든 섹션 들여쓰기 수정 완료');

