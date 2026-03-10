const { execSync } = require('child_process');
const opts = { cwd: 'c:/work/uwo/gatrix', encoding: 'utf8', stdio: 'inherit' };
try {
  execSync('git add -A', opts);
  execSync('git commit --amend --no-edit', opts);
  execSync('git pull --rebase', opts);
  execSync('git push', opts);
  console.log('Successfully pulled and pushed.');
} catch (error) {
  console.error('Failed to pull and push:', error.message);
}
require('fs').unlinkSync(__filename);
