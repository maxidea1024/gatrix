const axios = require('axios');

async function testMarkAsRead() {
  console.log('🔄 Testing markAsRead API...');

  try {
    const startTime = Date.now();

    const response = await axios.post(
      'http://localhost:3001/api/v1/channels/2/read',
      {
        messageId: 125,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkFkbWluIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNDYwNzI5MywiZXhwIjoxNzM0NjkzNjkzfQ.Ej7Ej7Ej7Ej7Ej7Ej7Ej7Ej7Ej7Ej7Ej7Ej7Ej7E', // 실제 토큰으로 교체 필요
        },
        timeout: 10000,
      }
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Success in ${duration}ms:`, response.data);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Failed in ${duration}ms:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code,
    });
  }
}

testMarkAsRead();
