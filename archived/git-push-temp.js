const { execSync } = require('child_process');
try {
  console.log('Adding files...');
  execSync('git add .', { stdio: 'inherit' });
  
  console.log('Committing changes...');
  execSync('git commit -m "chore: Rename server SDK to @gatrix/gatrix-node-server-sdk and relocate"', { stdio: 'inherit' });
  
  console.log('Pushing to remote...');
  execSync('git push', { stdio: 'inherit' });
  
  console.log('Successfully pushed changes.');
} catch (e) {
  console.error('Failed to execute git commands:', e.message);
  process.exit(1);
}
