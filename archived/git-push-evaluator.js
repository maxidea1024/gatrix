const { execSync } = require('child_process');
const opts = { cwd: 'c:/work/uwo/gatrix', encoding: 'utf8' };
execSync('git add -A', opts);
execSync('git commit -m "fix: delegate strategy-specific logic to each strategy isEnabled() instead of generic rollout check. Updated SERVER_SDK_SPEC."', opts);
console.log(execSync('git push', opts));
