const crypto = require('crypto');
const bcrypt = require('bcrypt');

// 테스트용 API 토큰 생성
function generateTestToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');
  console.log('🔑 Generated test token:');
  console.log(`Plain token: ${plainToken}`);
  
  // 해시 생성 (데이터베이스에 저장될 값)
  const saltRounds = 10;
  bcrypt.hash(plainToken, saltRounds, (err, hash) => {
    if (err) {
      console.error('Error hashing token:', err);
      return;
    }
    
    console.log(`Token hash: ${hash}`);
    console.log('\n📝 SQL to insert test token:');
    console.log(`
INSERT INTO g_api_access_tokens (
  tokenName, 
  tokenHash, 
  tokenType, 
  environmentId, 
  createdBy, 
  createdAt, 
  updatedAt
) VALUES (
  'Test Client Token', 
  '${hash}', 
  'client', 
  1, 
  1, 
  NOW(), 
  NOW()
);`);
    
    console.log('\n💡 Use this plain token for API calls:');
    console.log(plainToken);
  });
}

generateTestToken();
