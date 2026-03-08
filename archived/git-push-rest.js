const { execSync } = require('child_process');
const opts = { cwd: 'c:/work/uwo/gatrix', encoding: 'utf8', stdio: 'inherit' };
execSync('git add -A', opts);
execSync('git reset -- archived/edge-errors.txt archived/fix-pubsub-calls.js archived/tsc-errors.txt', opts);
execSync('git commit -m "refactor: server-sdk environment parameter, edge caching, pub-sub channel subscription updates"', opts);
execSync('git push', opts);
