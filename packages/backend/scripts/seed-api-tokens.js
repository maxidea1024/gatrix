require('dotenv').config();

async function runSeed() {
  try {
    console.log('Starting API tokens seed...');
    console.log('Please use: node scripts/seed-api-access-tokens.js');
    console.log('The old migration file has been removed.');
    process.exit(0);
  } catch (error) {
    console.error('API tokens seed failed:', error);
    process.exit(1);
  }
}

runSeed();
