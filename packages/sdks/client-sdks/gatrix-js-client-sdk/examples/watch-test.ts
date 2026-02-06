/**
 * Real-time flag change detection example
 *
 * Watches all flags for changes and logs updates in real-time.
 * Press Ctrl+C to stop.
 *
 * Usage:
 *   yarn example:watch
 *   # or
 *   npx ts-node examples/watch-test.ts
 */

import { GatrixClient, EVENTS, InMemoryStorageProvider, FlagProxy } from '../src';

async function main() {
  console.log('=== Gatrix JS Client SDK - Real-time Watch Test ===\n');

  const client = new GatrixClient({
    apiUrl: process.env.GATRIX_URL || 'http://localhost:45000/api/v1',
    apiToken: process.env.GATRIX_API_TOKEN || 'gatrix-unsecured-client-api-token',
    appName: process.env.GATRIX_APP || 'test-app',
    environment: process.env.GATRIX_ENV || 'development',
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
      watchGroup.watchFlag(flag.name, (proxy: FlagProxy) => {
        const json = JSON.stringify({
          enabled: proxy.enabled,
          variant: proxy.variant.name,
          variantType: proxy.variantType,
          payload: proxy.variant.payload,
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
        variant: f.variant?.name,
        variantType: f.variantType,
        payload: f.variant?.payload,
      });
      console.log(`  ${state} ${name}: ${json}`);
    });
    console.log('');

    // Keep the process running
    await new Promise(() => {}); // Never resolves
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
