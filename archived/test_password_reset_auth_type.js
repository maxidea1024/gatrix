// Test script to verify password reset functionality with authType validation
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

async function testPasswordResetForLocalUser() {
  console.log('Testing password reset for local user...');

  try {
    const response = await axios.post(`${BASE_URL}/auth/forgot-password`, {
      email: 'admin@motifgames.com', // Assuming this is a local user
    });

    console.log('Local user password reset response:', response.data);
  } catch (error) {
    console.error('Local user password reset error:', error.response?.data || error.message);
  }
}

async function testPasswordResetForOAuthUser() {
  console.log('Testing password reset for OAuth user...');

  try {
    const response = await axios.post(`${BASE_URL}/auth/forgot-password`, {
      email: 'test@github.local', // Assuming this is a GitHub OAuth user
    });

    console.log('OAuth user password reset response:', response.data);
  } catch (error) {
    console.error('OAuth user password reset error:', error.response?.data || error.message);
  }
}

async function testPasswordChangeForLocalUser() {
  console.log('Testing password change for local user...');

  // This would require authentication token
  // For now, just showing the structure
  console.log('Password change test requires authentication token');
}

async function runTests() {
  console.log('=== Testing Password Reset with AuthType Validation ===\n');

  await testPasswordResetForLocalUser();
  console.log('');

  await testPasswordResetForOAuthUser();
  console.log('');

  await testPasswordChangeForLocalUser();
  console.log('');

  console.log('=== Tests completed ===');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testPasswordResetForLocalUser,
  testPasswordResetForOAuthUser,
  testPasswordChangeForLocalUser,
};
