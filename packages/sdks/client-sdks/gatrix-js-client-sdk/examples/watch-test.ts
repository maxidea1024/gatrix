/**
 * Real-time flag change detection example
 *
 * Watches all flags for changes and logs updates in real-time.
 * Press Ctrl+C to stop.
 *
 * Usage:
 *   yarn example:watch
 *   npx ts-node examples/watch-test.ts
 *   npx ts-node examples/watch-test.ts --url <url> --token <token>
 *   npx ts-node examples/watch-test.ts --config ./config.json
 */

import { GatrixClient, EVENTS, InMemoryStorageProvider, FlagProxy } from '../src';
import { parseConfig, printConfig } from './config';

async function main() {
  console.log('=== Gatrix JS Client SDK - Real-time Watch Test ===\n');

  const config = parseConfig();
  printConfig(config);
  console.log();

  const client = new GatrixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    appName: config.appName,
    environment: config.environment,
    storageProvider: new InMemoryStorageProvider(),
    features: {
      refreshInterval: 1,
    },
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n--- Shutting down ---');
    await client.stop();
    console.log('Goodbye!');
    process.exit(0);
  });

  // Event emoji map for better visual distinction
  const eventEmoji: Record<string, string> = {
    'flags.init': '🚀',
    'flags.ready': '✅',
    'flags.fetch': '📡',
    'flags.update': '🔄',
    'flags.error': '❌',
    'flags.recovered': '💚',
    'flags.sync': '🔁',
    'flags.impression': '👁️',
  };

  // Track ALL SDK events with single onAny listener
  client.onAny((event, data) => {
    // Check if it's a flag-specific update event (e.g., flags.my-flag:update)
    const emoji = event.includes(':update') ? '📝' : eventEmoji[event] || '📌';
    const eventInfo = data ? JSON.stringify(data) : '';
    console.log(`[${timestamp()}] ${emoji} [${event}]: ${eventInfo}`);
  });

  try {
    console.log('Starting client...');
    await client.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get all flags
    const flags = client.features.getAllFlags();
    console.log(`\nFound ${flags.length} flag(s). Setting up watchers...\n`);

    // Create a watch group for all flags
    const watchGroup = client.features.createWatchGroup('all-flags');

    // Watch each flag for changes
    for (const flag of flags) {
      watchGroup.watchRealtimeFlag(flag.name, (proxy: FlagProxy) => {
        const json = JSON.stringify({
          enabled: proxy.enabled,
          variant: proxy.variant.name,
          valueType: proxy.valueType,
          value: proxy.variant.value,
        });
        console.log(`[${timestamp()}] 🚨 FLAG CHANGED: ${proxy.name}: ${json}`);
      });
    }

    console.log('--- Watching all flags for changes ---');
    console.log(`Refresh interval: 5 seconds`);
    console.log(`Press Ctrl+C to stop.\n`);

    // Print initial state
    console.log('--- Current Flag States ---');
    const maxLen = Math.max(...flags.map((f) => f.name.length));
    flags.forEach((f) => {
      const state = f.enabled ? '✅' : '❌';
      const name = f.name.padEnd(maxLen);
      const json = JSON.stringify({
        enabled: f.enabled,
        variant: f.variant.name,
        valueType: f.valueType,
        value: f.variant.value,
      });
      console.log(`  ${state} ${name}: ${json}`);
    });
    console.log('');

    // Keep the process running
    await new Promise(() => { }); // Never resolves
  } catch (error: any) {
    console.error('Error:', error.message);
    await client.stop();
    process.exit(1);
  }
}

function timestamp(): string {
  return new Date().toISOString().substr(11, 12);
}

main();
