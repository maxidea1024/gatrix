const http = require('http');

// 백엔드에서 채팅 서버로 연결 테스트
function testBackendToChatServer() {
  console.log('🔄 Testing backend to chat server connection...');

  const postData = JSON.stringify({
    messageId: 162,
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/channels/6/read',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      Authorization: 'Bearer test-token',
    },
    timeout: 10000,
  };

  console.log('Request options:', options);

  const req = http.request(options, (res) => {
    console.log(`✅ Chat server responded with status: ${res.statusCode}`);
    console.log('Response headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response body:', data);
    });
  });

  req.on('error', (err) => {
    console.log(`❌ Connection failed:`, err.message);
    console.log('Error details:', err);
  });

  req.on('timeout', () => {
    console.log(`❌ Connection timeout`);
    req.destroy();
  });

  req.write(postData);
  req.end();
}

testBackendToChatServer();
