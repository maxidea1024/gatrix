const http = require('http');

const options = {
    hostname: 'localhost',
    port: 45000,
    path: '/api/v1/admin/orgs/01KJJCTXDZ0BP2DGMFTTGAZB6D/projects/01KJJCTXN41GQR308FTJCRW437/environments/01KJJCTXN8V9VC4W0S0CMDXBN8/related-data',
    method: 'GET',
    headers: {
        'Cookie': 'accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMUtKSkNUWE1ETTFDSlg3QkRBRUZYTUtUNiIsIm9yZ0lkIjoiMDFLSkpDVFhEWjBCUDJER01GVFRHQVpCNkQiLCJvcmdSb2xlIjoiYWRtaW4iLCJpc3MiOiJnYXRyaXgiLCJpYXQiOjE3NzIzNTgxMzQsImV4cCI6MTc3Mjk2MjkzNH0.kPTy_6xWCvqJ9p_ELjkPpJlLjCPq2m2h6h5JIvLpHkA'
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const parsed = JSON.parse(data);
            if (!parsed.success) {
                console.log('Error:', parsed.message);
                console.log('Full:', JSON.stringify(parsed, null, 2).substring(0, 500));
            } else {
                console.log('Success');
            }
        } catch (e) {
            console.log('Response:', data.substring(0, 500));
        }
    });
});
req.on('error', e => console.error('Request error:', e.message));
req.end();
