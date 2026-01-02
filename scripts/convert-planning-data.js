#!/usr/bin/env node

/**
 * Planning Data Conversion CLI Tool (Root Wrapper)
 *
 * This wrapper script ensures paths are resolved relative to the current working directory,
 * not the backend package directory.
 *
 * Usage:
 *   yarn planning-data:convert [options]
 *
 * Options:
 *   --input <path>      CMS folder path (default: ./packages/backend/cms)
 *   --output <path>     Output folder path (default: ./packages/backend/data/planning)
 *   --verbose           Verbose logging
 *   --help              Show help
 */

const { spawnSync } = require('child_process');
const path = require('path');

// Parse arguments to resolve paths relative to CWD
const args = process.argv.slice(2);
const cwd = process.cwd();

// Find and resolve input/output paths
const resolvedArgs = [];
for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --input=value or --output=value format
    if (arg.startsWith('--input=')) {
        const value = arg.substring('--input='.length);
        const resolvedPath = path.resolve(cwd, value);
        resolvedArgs.push('--input', resolvedPath);
    } else if (arg.startsWith('--output=')) {
        const value = arg.substring('--output='.length);
        const resolvedPath = path.resolve(cwd, value);
        resolvedArgs.push('--output', resolvedPath);
    }
    // Handle --input value or --output value format
    else if (arg === '--input' || arg === '--output') {
        resolvedArgs.push(arg);
        if (args[i + 1] && !args[i + 1].startsWith('--')) {
            const resolvedPath = path.resolve(cwd, args[i + 1]);
            resolvedArgs.push(resolvedPath);
            i++;
        }
    } else {
        resolvedArgs.push(arg);
    }
}

// Path to the actual TypeScript script in backend
const backendDir = path.join(__dirname, '../packages/backend');
const scriptPath = path.join(backendDir, 'scripts/convert-planning-data.ts');

// Run ts-node with the backend script
const result = spawnSync(
    'yarn',
    ['ts-node', scriptPath, ...resolvedArgs],
    {
        cwd: backendDir,
        stdio: 'inherit',
        shell: true,
    }
);

process.exit(result.status || 0);
