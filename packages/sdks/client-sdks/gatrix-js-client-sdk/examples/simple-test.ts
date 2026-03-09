/**
 * Simple SDK test example
 *
 * Usage:
 *   yarn example:simple
 *   npx ts-node examples/simple-test.ts
 *   npx ts-node examples/simple-test.ts --url <url> --token <token>
 *   npx ts-node examples/simple-test.ts --config ./config.json
 */

import { GatrixClient, EVENTS, InMemoryStorageProvider } from '../src';
import { parseConfig, printConfig } from './config';

async function main() {
  console.log('=== Gatrix JS Client SDK - Simple Test ===\n');

  const config = parseConfig();
  printConfig(config);
  console.log();

  // Initialize client with configuration
  const client = new GatrixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    appName: config.appName,
    features: {
      storageProvider: new InMemoryStorageProvider(),
      context: {
        userId: 'user-12345',
        sessionId: 'session-abcde',
      },
    },
  });

  // Setup event listeners for ALL SDK events
  console.log('--- Registering Event Listeners ---');

  client.on(EVENTS.FLAGS_INIT, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.FLAGS_INIT}`);
  });

  client.on(EVENTS.FLAGS_READY, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.FLAGS_READY}`);
  });

  client.on(EVENTS.FLAGS_CHANGE, (data) => {
    console.log(
      `[${timestamp()}] EVENT: ${EVENTS.FLAGS_CHANGE}`,
      data?.flags ? `(${data.flags.length} flags)` : ''
    );
  });

  client.on(EVENTS.SDK_ERROR, (data) => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.SDK_ERROR}`, data);
  });

  client.on(EVENTS.FLAGS_IMPRESSION, (data) => {
    console.log(
      `[${timestamp()}] EVENT: ${EVENTS.FLAGS_IMPRESSION}`,
      `flag=${data.flagName}, enabled=${data.enabled}`
    );
  });

  client.on(EVENTS.FLAGS_SYNC, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.FLAGS_SYNC}`);
  });

  client.on(EVENTS.FLAGS_RECOVERED, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.FLAGS_RECOVERED}`);
  });

  try {
    // Start and wait for flags
    console.log('\n--- Starting Client ---');
    await client.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Print all flags
    console.log('\n--- All Flags ---');
    const flags = client.features.getAllFlags();
    console.log(`Found ${flags.length} flag(s):`);
    flags.forEach((f) => console.log(`  ${f.name}: enabled=${f.enabled}`));

    // Test isEnabled to trigger impression event
    console.log('\n--- Testing isEnabled (triggers IMPRESSION) ---');
    if (flags.length > 0) {
      const testFlag = flags[0].name;
      const enabled = client.features.isEnabled(testFlag);
      console.log(`  isEnabled('${testFlag}'): ${enabled}`);
    }

    // Print SDK stats
    console.log('\n--- SDK Stats ---');
    const stats = client.features.getStats();
    console.log(`  totalFlagCount:  ${stats.totalFlagCount}`);
    console.log(`  fetchFlagsCount: ${stats.fetchFlagsCount}`);
    console.log(`  sdkState:        ${stats.sdkState}`);

    // Cleanup
    await client.stop();
    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('Test failed:', error.message);
    await client.stop();
    process.exit(1);
  }
}

function timestamp(): string {
  return new Date().toISOString().substr(11, 12);
}

main();
