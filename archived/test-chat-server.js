const http = require('http');

// 채팅 서버 기본 연결 테스트
function testChatServerConnection() {
  console.log('🔄 Testing chat server connection...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/',
    method: 'GET',
    timeout: 5000,
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Chat server responded with status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (err) => {
    console.log(`❌ Connection failed:`, err.message);
  });

  req.on('timeout', () => {
    console.log(`❌ Connection timeout`);
    req.destroy();
  });

  req.end();
}

testChatServerConnection();
