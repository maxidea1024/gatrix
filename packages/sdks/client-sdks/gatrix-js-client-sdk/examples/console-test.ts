/**
 * Console-based runtime test for Gatrix JS Client SDK
 *
 * Usage:
 *   npx ts-node examples/console-test.ts
 *   npx ts-node examples/console-test.ts --url <url> --token <token>
 *   npx ts-node examples/console-test.ts --config ./config.json
 */

import { GatrixClient, EVENTS, InMemoryStorageProvider } from '../src';
import { parseConfig, printConfig } from './config';

async function main() {
  console.log('='.repeat(60));
  console.log('Gatrix JS Client SDK - Console Test');
  console.log('='.repeat(60));
  console.log();

  const config = parseConfig();
  printConfig(config);
  console.log();

  // Initialize client
  const client = new GatrixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    appName: config.appName,
    environment: config.environment,
    storageProvider: new InMemoryStorageProvider(),
    context: {
      userId: 'test-user-123',
      properties: {
        plan: 'premium',
        country: 'KR',
      },
    },
  });

  // Setup event listeners
  client.on(EVENTS.INIT, () => {
    console.log('[Event] INIT - SDK initialized');
  });

  client.on(EVENTS.READY, () => {
    console.log('[Event] READY - Flags loaded from server');
  });

  client.on(EVENTS.UPDATE, (data) => {
    console.log('[Event] UPDATE - Flags updated', data);
  });

  client.on(EVENTS.ERROR, (data) => {
    console.log('[Event] ERROR -', data);
  });

  try {
    // Start client
    console.log('\n--- Starting client ---');
    await client.start();
    console.log('Client started successfully!\n');

    // Wait a moment for async operations
    await sleep(500);

    // Get all flags
    console.log('\n--- All Flags ---');
    const allFlags = client.features.getAllFlags();
    if (allFlags.length === 0) {
      console.log('No flags found. Make sure the server is running and has flags configured.');
    } else {
      for (const flag of allFlags) {
        console.log(`  ${flag.name}: enabled=${flag.enabled}, variant=${flag.variant.name}`);
      }
    }

    // Test isEnabled
    console.log('\n--- isEnabled Tests ---');
    testIsEnabled(client, 'test-feature');
    testIsEnabled(client, 'maintenance-mode');
    testIsEnabled(client, 'new-ui');
    testIsEnabled(client, 'non-existent-flag');

    // Test variations
    console.log('\n--- Variation Tests ---');
    testBoolVariation(client, 'test-feature', false);
    testStringVariation(client, 'banner-text', 'default-banner');
    testNumberVariation(client, 'max-items', 10);
    testJsonVariation(client, 'ui-config', { theme: 'light' });

    // Stop client
    console.log('\n--- Stopping client ---');
    client.stop();
    console.log('Client stopped.\n');

    console.log('='.repeat(60));
    console.log('Test completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error during test:', error);
    client.stop();
    process.exit(1);
  }
}

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function testIsEnabled(client: GatrixClient, flagName: string): void {
  const result = client.features.isEnabled(flagName);
  console.log(`  isEnabled('${flagName}'): ${result}`);
}

function testBoolVariation(client: GatrixClient, flagName: string, defaultValue: boolean): void {
  const result = client.features.boolVariation(flagName, defaultValue);
  console.log(`  boolVariation('${flagName}', ${defaultValue}): ${result}`);
}

function testStringVariation(client: GatrixClient, flagName: string, defaultValue: string): void {
  const result = client.features.stringVariation(flagName, defaultValue);
  console.log(`  stringVariation('${flagName}', '${defaultValue}'): '${result}'`);
}

function testNumberVariation(client: GatrixClient, flagName: string, defaultValue: number): void {
  const result = client.features.numberVariation(flagName, defaultValue);
  console.log(`  numberVariation('${flagName}', ${defaultValue}): ${result}`);
}

function testJsonVariation(client: GatrixClient, flagName: string, defaultValue: object): void {
  const result = client.features.jsonVariation(flagName, defaultValue);
  console.log(
    `  jsonVariation('${flagName}', ${JSON.stringify(defaultValue)}): ${JSON.stringify(result)}`
  );
}

// Run
main().catch(console.error);
