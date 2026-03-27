const fs = require('fs');
const content = fs.readFileSync('c:/work/uwo/gatrix/packages/backend/src/services/change-request-service.ts', 'utf-8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('execute') || line.includes('Execute') || line.includes('apply') || line.includes('Apply') || line.includes('merge') || line.includes('Merge')) {
    console.log(`${i + 1}: ${line.trimStart().substring(0, 140)}`);
  }
}
