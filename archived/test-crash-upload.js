const axios = require('axios');

// 테스트용 API 토큰 (실제 토큰으로 교체 필요)
const API_TOKEN = 'your-client-api-token-here';
const BASE_URL = 'http://localhost:5001';

async function testCrashUpload() {
  console.log('🔍 Testing crash upload API...');
  
  const crashData = {
    pubId: 'test-crash-001',
    userId: 1,
    platform: 0, // Android
    branch: 0,   // Release
    majorVer: 1,
    minorVer: 2,
    buildNum: 3,
    patchNum: 0,
    stack: `java.lang.NullPointerException: Attempt to invoke virtual method 'int java.lang.String.length()' on a null object reference
    at com.example.game.GameActivity.onCreate(GameActivity.java:42)
    at android.app.Activity.performCreate(Activity.java:7136)
    at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:3266)
    at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:3409)
    at android.app.servertransaction.LaunchActivityItem.execute(LaunchActivityItem.java:83)
    at android.app.servertransaction.TransactionExecutor.executeCallbacks(TransactionExecutor.java:135)
    at android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:95)
    at android.app.ActivityThread$H.handleMessage(ActivityThread.java:2016)
    at android.os.Handler.dispatchMessage(Handler.java:107)
    at android.os.Looper.loop(Looper.java:214)
    at android.app.ActivityThread.main(ActivityThread.java:7356)`,
    userMsg: 'Game crashed when trying to start new level',
    log: 'Game log content here...',
    serverGroup: 'kr_server',
    marketType: 'google_play'
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/v1/client/crashes/upload`, crashData, {
      headers: {
        'X-API-Token': API_TOKEN,
        'X-Application-Name': 'test-game',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Crash upload successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.data);
    
  } catch (error) {
    console.log('❌ Crash upload failed!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error:`, error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// API 토큰이 설정되지 않은 경우 안내
if (API_TOKEN === 'your-client-api-token-here') {
  console.log('⚠️  Please set a valid API token in the script before running.');
  console.log('1. Go to the admin panel');
  console.log('2. Navigate to API Tokens');
  console.log('3. Create a new "client" type token');
  console.log('4. Replace the API_TOKEN value in this script');
} else {
  testCrashUpload();
}
