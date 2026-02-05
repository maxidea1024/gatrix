/**
 * Console-based runtime test for Gatrix JS Client SDK
 * 
 * Usage:
 *   npx ts-node examples/console-test.ts
 * 
 * Or with custom URL and API key:
 *   GATRIX_URL=http://localhost:4001/api/features GATRIX_API_KEY=your-key npx ts-node examples/console-test.ts
 */

import { GatrixClient, EVENTS, InMemoryStorageProvider } from '../src';

// Configuration - override with environment variables
const config = {
    url: process.env.GATRIX_URL || 'http://localhost:4001/api/features',
    apiKey: process.env.GATRIX_API_KEY || 'test-client-key',
    appName: process.env.GATRIX_APP || 'console-test',
};

async function main() {
    console.log('='.repeat(60));
    console.log('Gatrix JS Client SDK - Console Test');
    console.log('='.repeat(60));
    console.log();
    console.log('Configuration:');
    console.log(`  URL:     ${config.url}`);
    console.log(`  API Key: ${config.apiKey.substring(0, 10)}...`);
    console.log(`  App:     ${config.appName}`);
    console.log();

    // Initialize client
    const client = new GatrixClient({
        ...config,
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
        const allFlags = client.getAllFlags();
        if (allFlags.length === 0) {
            console.log('No flags found. Make sure the server is running and has flags configured.');
        } else {
            for (const flag of allFlags) {
                console.log(`  ${flag.name}: enabled=${flag.enabled}, variant=${flag.variant?.name}`);
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

        // Test FlagProxy
        console.log('\n--- FlagProxy Tests ---');
        const flagProxy = client.features.getFlag('test-feature');
        console.log(`  FlagProxy('test-feature'):`);
        console.log(`    exists: ${flagProxy.exists}`);
        console.log(`    enabled: ${flagProxy.enabled}`);
        console.log(`    variant: ${flagProxy.variantName}`);
        console.log(`    reason: ${flagProxy.reason}`);

        // Test variationDetails
        console.log('\n--- VariationDetails Tests ---');
        const details = client.boolVariationDetails('test-feature', false);
        console.log(`  boolVariationDetails('test-feature'):`);
        console.log(`    value: ${details.value}`);
        console.log(`    reason: ${details.reason}`);
        console.log(`    flagExists: ${details.flagExists}`);

        // Stop client
        console.log('\n--- Stopping client ---');
        await client.stop();
        console.log('Client stopped.\n');

        console.log('='.repeat(60));
        console.log('Test completed successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error during test:', error);
        await client.stop();
        process.exit(1);
    }
}

// Helper functions
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function testIsEnabled(client: GatrixClient, flagName: string): void {
    const result = client.isEnabled(flagName);
    console.log(`  isEnabled('${flagName}'): ${result}`);
}

function testBoolVariation(client: GatrixClient, flagName: string, defaultValue: boolean): void {
    const result = client.boolVariation(flagName, defaultValue);
    console.log(`  boolVariation('${flagName}', ${defaultValue}): ${result}`);
}

function testStringVariation(client: GatrixClient, flagName: string, defaultValue: string): void {
    const result = client.stringVariation(flagName, defaultValue);
    console.log(`  stringVariation('${flagName}', '${defaultValue}'): '${result}'`);
}

function testNumberVariation(client: GatrixClient, flagName: string, defaultValue: number): void {
    const result = client.numberVariation(flagName, defaultValue);
    console.log(`  numberVariation('${flagName}', ${defaultValue}): ${result}`);
}

function testJsonVariation(client: GatrixClient, flagName: string, defaultValue: object): void {
    const result = client.jsonVariation(flagName, defaultValue);
    console.log(`  jsonVariation('${flagName}', ${JSON.stringify(defaultValue)}): ${JSON.stringify(result)}`);
}

// Run
main().catch(console.error);
