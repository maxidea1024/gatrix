/**
 * Script to add test crash events directly to database
 */

import { ClientCrash } from '../models/ClientCrash';
import { CrashEvent } from '../models/CrashEvent';
import crypto from 'crypto';
import { CRASH_CONSTANTS } from '../types/crash';
import { generateULID } from '../utils/ulid';

// Knex is already initialized in config/knex.ts and Model.knex() is already called there

// Sample crash stack traces with different first lines
const testCrashes = [
  {
    platform: 'windows',
    branch: 'main',
    environment: 'production',
    appVersion: '1.2.3',
    resVersion: '1.0.5',
    accountId: 'ACC001',
    characterId: 'CHAR001',
    gameUserId: 'USER001',
    userName: 'TestUser1',
    userMessage: 'Game crashed while loading level',
    stack: `NullReferenceException: Object reference not set to an instance of an object
  at GameEngine.LevelLoader.LoadAssets() in C:\\Game\\LevelLoader.cs:line 45
  at GameEngine.SceneManager.LoadScene(String sceneName) in C:\\Game\\SceneManager.cs:line 123
  at GameEngine.GameController.Start() in C:\\Game\\GameController.cs:line 67`,
    marketType: 'steam',
    isEditor: false,
  },
  {
    platform: 'android',
    branch: 'main',
    environment: 'production',
    appVersion: '1.2.3',
    resVersion: '1.0.5',
    accountId: 'ACC002',
    characterId: 'CHAR002',
    gameUserId: 'USER002',
    userName: 'TestUser2',
    userMessage: 'App froze during combat',
    stack: `IndexOutOfRangeException: Index was outside the bounds of the array
  at CombatSystem.DamageCalculator.ApplyDamage(Int32 targetId) in CombatSystem.cs:line 234
  at CombatSystem.AttackHandler.ProcessAttack() in AttackHandler.cs:line 89
  at GameLoop.Update() in GameLoop.cs:line 156`,
    marketType: 'googleplay',
    isEditor: false,
  },
  {
    platform: 'ios',
    branch: 'qa_2025',
    environment: 'qa',
    appVersion: '1.3.0-beta',
    resVersion: '1.1.0',
    accountId: 'ACC003',
    characterId: 'CHAR003',
    gameUserId: 'USER003',
    userName: 'QATester1',
    userMessage: 'Crash when opening inventory',
    stack: `ArgumentNullException: Value cannot be null. Parameter name: item
  at InventorySystem.ItemManager.AddItem(Item item) in ItemManager.cs:line 78
  at UI.InventoryPanel.OnItemClicked(Int32 itemId) in InventoryPanel.cs:line 145
  at UnityEngine.EventSystems.ExecuteEvents.Execute() in ExecuteEvents.cs:line 234`,
    marketType: 'apple',
    isEditor: false,
  },
  {
    platform: 'windows',
    branch: 'dev',
    environment: 'dev',
    appVersion: '1.4.0-dev',
    resVersion: '1.2.0-dev',
    accountId: 'ACC004',
    characterId: 'CHAR004',
    gameUserId: 'USER004',
    userName: 'Developer1',
    userMessage: 'Testing new feature - expected crash',
    stack: `NotImplementedException: The method or operation is not implemented
  at NewFeature.ExperimentalSystem.Initialize() in ExperimentalSystem.cs:line 12
  at GameEngine.FeatureManager.LoadFeatures() in FeatureManager.cs:line 56
  at GameEngine.Startup.OnApplicationStart() in Startup.cs:line 34`,
    marketType: 'steam',
    isEditor: true,
  },
  {
    platform: 'android',
    branch: 'main',
    environment: 'production',
    appVersion: '1.2.3',
    resVersion: '1.0.5',
    accountId: 'ACC005',
    characterId: 'CHAR005',
    gameUserId: 'USER005',
    userName: 'TestUser5',
    userMessage: 'Network error during multiplayer',
    stack: `TimeoutException: The operation has timed out
  at NetworkManager.ConnectionHandler.Connect(String serverUrl) in ConnectionHandler.cs:line 167
  at MultiplayerSystem.JoinGame(String gameId) in MultiplayerSystem.cs:line 89
  at UI.LobbyPanel.OnJoinButtonClicked() in LobbyPanel.cs:line 234`,
    marketType: 'googleplay',
    isEditor: false,
  },
];

async function addTestCrashes() {
  console.log('Adding test crash events directly to database...');

  try {
    for (let i = 0; i < testCrashes.length; i++) {
      const crashData = testCrashes[i];
      console.log(`\nAdding crash ${i + 1}/${testCrashes.length}...`);
      console.log(`  Platform: ${crashData.platform}`);
      console.log(`  Branch: ${crashData.branch}`);
      console.log(`  Environment: ${crashData.environment}`);

      const firstLine =
        crashData.stack.split('\n')[0]?.substring(0, CRASH_CONSTANTS.MaxFirstLineLen) || '';
      console.log(`  First Line: ${firstLine}`);

      try {
        // Generate crash hash from stack trace
        const chash = crypto.createHash('md5').update(crashData.stack).digest('hex');

        // Check if crash already exists
        let crash = await ClientCrash.findByHashAndBranch(chash, crashData.branch);
        let isNewCrash = false;

        if (!crash) {
          // Create new crash using query().insert()
          const crashId = generateULID();
          crash = await ClientCrash.query().insertAndFetch({
            id: crashId,
            chash,
            branch: crashData.branch,
            environment: crashData.environment,
            platform: crashData.platform,
            marketType: crashData.marketType,
            isEditor: crashData.isEditor || false,
            firstLine,
            stackFilePath: '', // Will be set later if needed
            crashesCount: 1,
            firstCrashAt: new Date(),
            lastCrashAt: new Date(),
            crashesState: 0, // OPEN
          });
          isNewCrash = true;
          console.log(`  ✓ Created new crash: ${crash.id}`);
        } else {
          console.log(`  ℹ Using existing crash: ${crash.id}`);
        }

        // Create crash event
        const event = await CrashEvent.create({
          crashId: crash.id,
          firstLine,
          platform: crashData.platform,
          marketType: crashData.marketType,
          branch: crashData.branch,
          environment: crashData.environment,
          isEditor: crashData.isEditor || false,
          appVersion: crashData.appVersion,
          resVersion: crashData.resVersion,
          accountId: crashData.accountId,
          characterId: crashData.characterId,
          gameUserId: crashData.gameUserId,
          userName: crashData.userName,
          userMessage: crashData.userMessage,
        });

        console.log(`  ✓ Created crash event: ${event.id}`);

        // Update crash with event info if not new
        if (!isNewCrash) {
          await crash.incrementCount(event.id);
          console.log(`  ✓ Updated crash count`);
        } else {
          // Set first and last crash event IDs for new crash
          await crash.$query().patch({
            firstCrashEventId: event.id,
            lastCrashEventId: event.id,
          });
        }
      } catch (error: any) {
        console.error(`  ✗ Failed: ${error.message}`);
        console.error(error);
      }
    }

    console.log('\n✓ All test crashes added successfully!');
  } catch (error) {
    console.error('Error adding test crashes:', error);
    throw error;
  }
}

// Run the script
addTestCrashes()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
