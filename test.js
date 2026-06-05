const text1 = 'service:game-world* ';
const text2 = 'service:* ';
const text3 = 'service:\"*\" ';
const text4 = 'service:\"game*world\" ';
const text5 = 'service:\"*game*world*\" ';
const text6 = 'service:** ';

const re = /(!?[\\w.-]+:(?:\"[^\"]*\"|'[^']*'|\"[^\"]*$|'[^']*$|\\S+))|(\\bAND\\b|\\bOR\\b)/g;

[text1, text2, text3, text4, text5, text6].forEach(text => {
  let match;
  console.log('Testing:', text);
  while ((match = re.exec(text)) !== null) {
    console.log('  ->', match[0]);
  }
});
