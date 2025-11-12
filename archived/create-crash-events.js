const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000';
const API_TOKEN = 'f785e99663c85c8daa76cb5b000c4e9cdcd5aaf4169ea386bc2084deea6f05fe';
const APPLICATION_NAME = 'test-game';

// Read crash files
const stackTrace = fs.readFileSync(path.join(__dirname, 'crash.callstack'), 'utf8');
const logData = fs.readFileSync(path.join(__dirname, 'crash.log'), 'utf8');

// Sample data arrays for variation
const platforms = ['Android', 'iOS', 'Windows', 'MacOS', 'Linux'];
const branches = ['main', 'develop', 'release/1.0', 'hotfix/crash-fix', 'feature/new-ui'];
const environments = ['production', 'staging', 'development', 'qa'];
const marketTypes = ['Google Play', 'App Store', 'Steam', 'Epic Games', 'Direct'];
const appVersions = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '2.0.0'];
const resVersions = ['100', '101', '102', '110', '200'];
const gameServerIds = ['server-001', 'server-002', 'server-003', 'server-004', 'server-005'];
const userMessages = [
  'Game crashed while loading level',
  'Crash occurred during combat',
  'Application froze and crashed',
  'Unexpected crash on startup',
  'Crash when opening inventory',
  'Game crashed after cutscene',
  'Random crash during gameplay',
  null, // Some events without user message
  null,
  null
];

// Helper function to get random item from array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random user ID
function generateUserId() {
  return `user_${Math.floor(Math.random() * 100000)}`;
}

// Helper function to generate random character ID
function generateCharacterId() {
  return `char_${Math.floor(Math.random() * 50000)}`;
}

// Helper function to generate random account ID
function generateAccountId() {
  return `acc_${Math.floor(Math.random() * 80000)}`;
}

// Helper function to generate random username
function generateUsername() {
  const prefixes = ['Player', 'Gamer', 'User', 'Hero', 'Warrior'];
  const suffixes = Math.floor(Math.random() * 10000);
  return `${getRandomItem(prefixes)}${suffixes}`;
}

// Function to create a single crash event
async function createCrashEvent(index) {
  const crashData = {
    platform: getRandomItem(platforms),
    branch: getRandomItem(branches),
    environment: getRandomItem(environments),
    stack: stackTrace,
    marketType: getRandomItem(marketTypes),
    isEditor: Math.random() > 0.9, // 10% chance of being editor crash
    appVersion: getRandomItem(appVersions),
    resVersion: getRandomItem(resVersions),
    accountId: generateAccountId(),
    characterId: generateCharacterId(),
    gameUserId: generateUserId(),
    userName: generateUsername(),
    gameServerId: getRandomItem(gameServerIds),
    userMessage: getRandomItem(userMessages),
    log: logData
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/client/crashes/upload`,
      crashData,
      {
        headers: {
          'X-API-Token': API_TOKEN,
          'X-Application-Name': APPLICATION_NAME,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log(`✅ [${index + 1}/100] Crash event created successfully`);
    console.log(`   Crash ID: ${response.data.data.crashId}`);
    console.log(`   Event ID: ${response.data.data.eventId}`);
    console.log(`   Is New Crash: ${response.data.data.isNewCrash}`);
    
    return {
      success: true,
      index: index + 1,
      crashId: response.data.data.crashId,
      eventId: response.data.data.eventId,
      isNewCrash: response.data.data.isNewCrash
    };
  } catch (error) {
    console.error(`❌ [${index + 1}/100] Failed to create crash event`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error:`, JSON.stringify(error.response.data, null, 2));
      console.error(`   Sent data:`, JSON.stringify(crashData, null, 2));
    } else if (error.request) {
      console.error(`   No response received from server`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Code: ${error.code}`);
    } else {
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }

    return {
      success: false,
      index: index + 1,
      error: error.message || error.code || 'Unknown error',
      crashData: crashData
    };
  }
}

// Main function to create crash events
async function createMultipleCrashEvents(count = 100) {
  console.log(`🚀 Starting to create ${count} crash events...\n`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Application: ${APPLICATION_NAME}\n`);

  const results = {
    total: count,
    successful: 0,
    failed: 0,
    newCrashes: 0,
    existingCrashes: 0,
    errors: []
  };

  const startTime = Date.now();

  // Create events sequentially to avoid overwhelming the server
  for (let i = 0; i < count; i++) {
    const result = await createCrashEvent(i);
    
    if (result.success) {
      results.successful++;
      if (result.isNewCrash) {
        results.newCrashes++;
      } else {
        results.existingCrashes++;
      }
    } else {
      results.failed++;
      results.errors.push({
        index: result.index,
        error: result.error
      });
    }

    // Add a small delay between requests to avoid rate limiting
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary Report');
  console.log('='.repeat(60));
  console.log(`Total Events: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🆕 New Crashes: ${results.newCrashes}`);
  console.log(`📝 Existing Crashes: ${results.existingCrashes}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('='.repeat(60));

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(err => {
      console.log(`   [${err.index}] ${err.error}`);
    });
  }

  console.log('\n✨ Done!');
}

// Run the script
const count = process.argv[2] ? parseInt(process.argv[2]) : 100;
createMultipleCrashEvents(count).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

