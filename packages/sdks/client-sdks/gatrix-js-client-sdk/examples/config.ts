/**
 * Shared configuration for Gatrix SDK examples
 *
 * Supports loading config from:
 * 1. Command line arguments (--url, --token, --app, --env)
 * 2. Config file (--config <path>)
 * 3. Default values (hardcoded)
 *
 * Usage:
 *   npx ts-node examples/<example>.ts
 *   npx ts-node examples/<example>.ts --url http://api.example.com/api/v1 --token mytoken
 *   npx ts-node examples/<example>.ts --config ./my-config.json
 */

import * as fs from 'fs';

export interface ExampleConfig {
    apiUrl: string;
    apiToken: string;
    appName: string;
    environment: string;
}

// Default configuration
const DEFAULTS: ExampleConfig = {
    apiUrl: 'http://localhost:45000/api/v1',
    apiToken: 'gatrix-unsecured-client-api-token',
    appName: 'test-app',
    environment: 'development',
};

/**
 * Parse command line arguments and return configuration
 */
export function parseConfig(): ExampleConfig {
    const args = process.argv.slice(2);
    let config = { ...DEFAULTS };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const next = args[i + 1];

        if (arg === '--config' && next) {
            // Load config from JSON file
            try {
                const fileContent = fs.readFileSync(next, 'utf-8');
                const fileConfig = JSON.parse(fileContent);
                config = { ...config, ...fileConfig };
            } catch (e) {
                console.error(`Failed to load config from ${next}:`, e);
                process.exit(1);
            }
            i++;
        } else if (arg === '--url' && next) {
            config.apiUrl = next;
            i++;
        } else if (arg === '--token' && next) {
            config.apiToken = next;
            i++;
        } else if (arg === '--app' && next) {
            config.appName = next;
            i++;
        } else if (arg === '--env' && next) {
            config.environment = next;
            i++;
        }
    }

    return config;
}

/**
 * Print configuration to console
 */
export function printConfig(config: ExampleConfig): void {
    console.log('Configuration:');
    console.log(`  API URL:     ${config.apiUrl}`);
    console.log(`  API Token:   ${config.apiToken.substring(0, 10)}...`);
    console.log(`  App Name:    ${config.appName}`);
    console.log(`  Environment: ${config.environment}`);
}
