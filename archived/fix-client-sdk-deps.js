const fs = require('fs');
const glob = require('glob');
const path = require('path');

const basePath = path.resolve('c:/work/uwo/gatrix/packages/sdks/client-sdks');
const files = glob.sync('**/package.json', { cwd: basePath, ignore: ['**/node_modules/**', '**/dist/**'] });

for (const file of files) {
  const fullPath = path.join(basePath, file);
  const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  let modified = false;

  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (pkg[depType] && pkg[depType]['@gatrix/gatrix-js-client-sdk']) {
      if (pkg[depType]['@gatrix/gatrix-js-client-sdk'] !== 'workspace:*') {
        pkg[depType]['@gatrix/gatrix-js-client-sdk'] = 'workspace:*';
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`Updated ${file}`);
  }
}
