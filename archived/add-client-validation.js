const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/work/uwo/gatrix/packages/sdks/client-sdks/gatrix-js-client-sdk/src/features-client.ts');
let content = fs.readFileSync(filePath, 'utf-8');
let lines = content.split('\n');

// 1. Add import for validateAll
const importLine = "import { validateAll } from './validate-params';";
if (!content.includes("from './validate-params'")) {
  // Add after the last import
  const lastImportIdx = lines.reduce((acc, line, idx) => {
    if (line.startsWith('import ') || line.startsWith("import {")) {
      return idx;
    }
    return acc;
  }, -1);
  
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
    console.log(`Added import at line ${lastImportIdx + 2}`);
  }
}

// 2. Add validation to public methods that receive flagName
// These are the public methods that users call directly:
const methodPatterns = [
  // isEnabled(flagName: string
  { sig: 'isEnabled(flagName: string', paramName: 'flagName' },
  // getFlag(flagName: string
  { sig: 'getFlag(flagName: string', paramName: 'flagName' },
  // getVariant(flagName: string
  { sig: 'getVariant(flagName: string', paramName: 'flagName' },
  // hasFlag(flagName: string
  { sig: 'hasFlag(flagName: string', paramName: 'flagName' },
];

for (const method of methodPatterns) {
  const sigIdx = lines.findIndex(l => l.includes(method.sig));
  if (sigIdx >= 0) {
    // Find the opening brace
    let braceIdx = sigIdx;
    while (braceIdx < lines.length && !lines[braceIdx].includes('{')) {
      braceIdx++;
    }
    // Check if next line already has validateAll
    if (braceIdx < lines.length - 1 && !lines[braceIdx + 1].includes('validateAll')) {
      const indent = '    ';
      lines.splice(braceIdx + 1, 0, `${indent}validateAll([{ param: '${method.paramName}', value: ${method.paramName}, type: 'string' }]);`);
      console.log(`Added validation to ${method.sig} at line ${braceIdx + 2}`);
    }
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log('Done.');
