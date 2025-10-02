const crypto = require('crypto');

// Generate a secure token for testing
const token = crypto.randomBytes(32).toString('hex');

console.log('🔑 Generated Server SDK Token:');
console.log(token);
console.log('');
console.log('Add this to your chat server .env file:');
console.log(`GATRIX_API_SECRET=${token}`);
console.log('');
console.log('⚠️  This is a test token. In production, create tokens through the admin interface.');
