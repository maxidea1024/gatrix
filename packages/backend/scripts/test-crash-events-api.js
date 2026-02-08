const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/admin/crash-events?page=1&limit=5',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);

    try {
      const json = JSON.parse(data);
      console.log('\nParsed Response:');
      console.log('- Success:', json.success);
      console.log('- Total:', json.total);
      console.log('- Data length:', json.data ? json.data.length : 0);
      if (json.data && json.data.length > 0) {
        console.log('- First event:', JSON.stringify(json.data[0], null, 2));
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
