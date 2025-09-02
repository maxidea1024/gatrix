const http = require('http');

async function testWhitelistAPI() {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/whitelist?page=1&limit=5',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZ2F0cml4LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NjgwNzk5NCwiZXhwIjoxNzU2ODk0Mzk0fQ.Ej_Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8',
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        
        try {
          const jsonData = JSON.parse(data);
          console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('Failed to parse JSON:', e.message);
        }
        
        resolve(data);
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    req.end();
  });
}

// 스크립트 실행
testWhitelistAPI().catch(console.error);
