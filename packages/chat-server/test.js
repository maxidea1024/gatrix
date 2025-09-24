console.log('Test script starting...');

try {
  console.log('Step 1: Basic console.log works');
  
  console.log('Step 2: Requiring config...');
  const { config } = require('./dist/config');
  console.log('Config loaded:', config ? 'OK' : 'FAILED');
  
  console.log('Step 3: Test completed successfully');
} catch (error) {
  console.error('Error in test:', error);
}
