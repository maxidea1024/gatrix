const fs = require('fs');

const fixFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  // strip out the broken lines
  const lines = content.split('\n').filter(l => !l.includes('pressEnterToUse'));
  fs.writeFileSync(file, lines.join('\n'));
};

fixFile('packages/frontend/src/locales/ko.ini');
fixFile('packages/frontend/src/locales/zh.ini');
fixFile('packages/frontend/src/locales/en.ini');

fs.appendFileSync('packages/frontend/src/locales/ko.ini', '\nargus.discover.pressEnterToUse="{{val}}" 사용하려면 Enter 또는 Space 키를 누르세요\n', 'utf8');
fs.appendFileSync('packages/frontend/src/locales/zh.ini', '\nargus.discover.pressEnterToUse=按 Enter 或 Space 键使用 "{{val}}"\n', 'utf8');
fs.appendFileSync('packages/frontend/src/locales/en.ini', '\nargus.discover.pressEnterToUse=Press Enter or Space to use "{{val}}"\n', 'utf8');
console.log('Fixed encodings!');
