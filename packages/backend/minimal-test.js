console.log('Starting minimal test...');

try {
  console.log('Loading config...');
  const config = require('./dist/config/index.js');
  console.log('Config loaded:', typeof config);
  console.log('Config default:', typeof config.default);
  console.log('Config config:', typeof config.config);
  
  console.log('Loading app...');
  const app = require('./dist/app.js');
  console.log('App loaded:', typeof app);
  console.log('App default:', typeof app.default);
  
  console.log('All modules loaded successfully');
} catch (error) {
  console.error('Error:', error);
}
