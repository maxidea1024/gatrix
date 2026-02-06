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
    environment: config.environment,
    storageProvider: new InMemoryStorageProvider(),
    context: {
      userId: 'user-12345',
      sessionId: 'session-abcde',
    },
  });

  // Setup event listeners for ALL SDK events
  console.log('--- Registering Event Listeners ---');

  client.on(EVENTS.INIT, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.INIT}`);
  });

  client.on(EVENTS.READY, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.READY}`);
  });

  client.on(EVENTS.UPDATE, (data) => {
    console.log(
      `[${timestamp()}] EVENT: ${EVENTS.UPDATE}`,
      data?.flags ? `(${data.flags.length} flags)` : ''
    );
  });

  client.on(EVENTS.ERROR, (data) => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.ERROR}`, data);
  });

  client.on(EVENTS.IMPRESSION, (data) => {
    console.log(
      `[${timestamp()}] EVENT: ${EVENTS.IMPRESSION}`,
      `flag=${data.featureName}, enabled=${data.enabled}`
    );
  });

  client.on(EVENTS.SYNC, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.SYNC}`);
  });

  client.on(EVENTS.RECOVERED, () => {
    console.log(`[${timestamp()}] EVENT: ${EVENTS.RECOVERED}`);
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
