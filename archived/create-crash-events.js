const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:55000';
const API_TOKEN = process.env.API_TOKEN || 'gatrix-unsecured-client-api-token';
const APPLICATION_NAME = 'test-game';

// Sample stack traces for variation (creates different crash groups)
const stackTraces = [
  `NullReferenceException: Object reference not set to an instance of an object
  at GameManager.Update () [0x00000] in <filename unknown>:0
  at UnityEngine.Object.Internal_InstantiateSingle () [0x00000] in <filename unknown>:0`,

  `IndexOutOfRangeException: Array index is out of range
  at InventorySystem.GetItem (Int32 index) [0x00010] in Assets/Scripts/Inventory.cs:45
  at PlayerController.UseItem () [0x00005] in Assets/Scripts/Player.cs:120`,

  `ArgumentNullException: Value cannot be null
  at NetworkManager.SendPacket (Packet p) [0x00000] in Assets/Scripts/Network.cs:88
  at GameClient.Send (String message) [0x00020] in Assets/Scripts/Client.cs:55`,

  `OutOfMemoryException: Out of memory
  at TextureLoader.LoadTexture (String path) [0x00040] in Assets/Scripts/Loader.cs:200
  at AssetManager.Initialize () [0x00010] in Assets/Scripts/Assets.cs:30`,

  `InvalidOperationException: Sequence contains no elements
  at System.Linq.Enumerable.First[TSource] () [0x00000] in <filename unknown>:0
  at QuestManager.GetActiveQuest () [0x00025] in Assets/Scripts/Quest.cs:78`,

  `StackOverflowException: The requested operation caused a stack overflow
  at RecursiveFunction.Calculate (Int32 n) [0x00005] in Assets/Scripts/Math.cs:15
  at GameLogic.Process () [0x00100] in Assets/Scripts/Logic.cs:200`,

  `TimeoutException: The operation has timed out
  at DatabaseConnection.Execute (String query) [0x00050] in Assets/Scripts/DB.cs:120
  at SaveManager.SaveGame () [0x00030] in Assets/Scripts/Save.cs:45`,

  `FileNotFoundException: Could not find file
  at ConfigLoader.Load (String path) [0x00010] in Assets/Scripts/Config.cs:30
  at GameSettings.Initialize () [0x00005] in Assets/Scripts/Settings.cs:20`,

  `AccessViolationException: Attempted to read or write protected memory
  at NativePlugin.CallNative () [0x00000] in <filename unknown>:0
  at AudioManager.PlaySound (Int32 id) [0x00015] in Assets/Scripts/Audio.cs:88`,

  `DivideByZeroException: Attempted to divide by zero
  at StatCalculator.GetAverage () [0x00008] in Assets/Scripts/Stats.cs:55
  at UIManager.UpdateStats () [0x00020] in Assets/Scripts/UI.cs:150`,

  `SocketException: Connection refused
  at NetworkClient.Connect (String host, Int32 port) [0x00030] in Assets/Scripts/Net.cs:40
  at GameSession.Start () [0x00010] in Assets/Scripts/Session.cs:25`,

  `SerializationException: Error deserializing object
  at DataSerializer.Deserialize[T] (Byte[] data) [0x00050] in Assets/Scripts/Serializer.cs:80
  at SaveGame.Load () [0x00020] in Assets/Scripts/SaveGame.cs:60`,

  `UnauthorizedAccessException: Access to the path is denied
  at FileSystem.WriteFile (String path, Byte[] data) [0x00015] in Assets/Scripts/FS.cs:45
  at CacheManager.SaveCache () [0x00010] in Assets/Scripts/Cache.cs:30`,

  `FormatException: Input string was not in a correct format
  at Int32.Parse (String s) [0x00000] in <filename unknown>:0
  at ConfigParser.ParseValue (String value) [0x00025] in Assets/Scripts/Parser.cs:70`,

  `NotImplementedException: The method is not implemented
  at AbstractHandler.Handle () [0x00000] in Assets/Scripts/Handler.cs:20
  at EventDispatcher.Dispatch (Event e) [0x00040] in Assets/Scripts/Events.cs:95`
];

const logData = `[2024-12-08 10:30:45] INFO: Game started
[2024-12-08 10:30:46] INFO: Loading assets...
[2024-12-08 10:30:50] WARN: Low memory warning
[2024-12-08 10:30:55] ERROR: Crash occurred`;

// Sample data arrays for variation
const platforms = ['android', 'ios', 'windows', 'mac'];
const branches = ['main', 'develop', 'qa_2025', 'release_1.0', 'hotfix_1.1'];
const environments = ['production', 'staging', 'development', 'qa'];
const marketTypes = ['googleplay', 'appstore', 'steam', 'epic', 'direct'];
const appVersions = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0'];
const resVersions = ['r100', 'r101', 'r102', 'r110', 'r200', 'r210'];
const gameServerIds = ['server-001', 'server-002', 'server-003', 'server-004', 'server-005', 'server-006', 'server-007', 'server-008'];
const userMessages = [
  'Game crashed while loading level',
  'Crash occurred during combat',
  'Application froze and crashed',
  'Unexpected crash on startup',
  'Crash when opening inventory',
  'Game crashed after cutscene',
  'Random crash during gameplay',
  'Crashed when connecting to server',
  'Memory error during boss fight',
  null, null, null, null // Some events without user message
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
async function createCrashEvent(index, totalCount) {
  const crashData = {
    platform: getRandomItem(platforms),
    branch: getRandomItem(branches),
    environment: getRandomItem(environments),
    stack: getRandomItem(stackTraces),
    marketType: getRandomItem(marketTypes),
    isEditor: Math.random() > 0.95, // 5% chance of being editor crash
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
        timeout: 30000
      }
    );

    // Only log every 100 events to reduce console spam
    if ((index + 1) % 100 === 0 || index === 0) {
      console.log(`✅ [${index + 1}/${totalCount}] Progress: ${((index + 1) / totalCount * 100).toFixed(1)}%`);
    }

    return {
      success: true,
      index: index + 1,
      crashId: response.data.data.crashId,
      eventId: response.data.data.eventId,
      isNewCrash: response.data.data.isNewCrash
    };
  } catch (error) {
    console.error(`❌ [${index + 1}/${totalCount}] Failed to create crash event`);
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
// Batch processing with concurrency control
async function createBatch(startIndex, batchSize, totalCount, results) {
  const promises = [];
  for (let i = 0; i < batchSize && startIndex + i < totalCount; i++) {
    promises.push(createCrashEvent(startIndex + i, totalCount));
  }

  const batchResults = await Promise.all(promises);

  for (const result of batchResults) {
    if (result.success) {
      results.successful++;
      if (result.isNewCrash) {
        results.newCrashes++;
      } else {
        results.existingCrashes++;
      }
    } else {
      results.failed++;
      if (results.errors.length < 10) { // Only keep first 10 errors
        results.errors.push({
          index: result.index,
          error: result.error
        });
      }
    }
  }

  return batchResults.length;
}

async function createMultipleCrashEvents(count = 100) {
  console.log(`🚀 Starting to create ${count} crash events...\n`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Application: ${APPLICATION_NAME}`);
  console.log(`Stack traces variations: ${stackTraces.length}\n`);

  const results = {
    total: count,
    successful: 0,
    failed: 0,
    newCrashes: 0,
    existingCrashes: 0,
    errors: []
  };

  const startTime = Date.now();
  const BATCH_SIZE = 10; // Process 10 requests concurrently

  // Process in batches for better performance
  for (let i = 0; i < count; i += BATCH_SIZE) {
    await createBatch(i, BATCH_SIZE, count, results);

    // Small delay between batches
    if (i + BATCH_SIZE < count) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const rate = (results.successful / parseFloat(duration)).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary Report');
  console.log('='.repeat(60));
  console.log(`Total Events: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🆕 New Crashes: ${results.newCrashes}`);
  console.log(`📝 Existing Crashes: ${results.existingCrashes}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`🚀 Rate: ${rate} events/sec`);
  console.log('='.repeat(60));

  if (results.errors.length > 0) {
    console.log('\n❌ First 10 Errors:');
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

