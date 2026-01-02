#!/usr/bin/env node

/**
 * CLI tool for uploading planning data to a remote Gatrix server.
 *
 * Usage:
 *   yarn upload-planning-data --api-url=https://gatrix.example.com --env=qa --dir=./planning-data --token=<TOKEN>
 *
 * Options:
 *   --api-url   (Required) Backend API URL (e.g., https://gatrix.example.com)
 *   --env       (Required) Target environment (dev, qa, production)
 *   --dir       (Required) Directory containing planning data files
 *   --token     (Required) API token for authentication. Can also use GATRIX_API_TOKEN env var.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const FormData = require('form-data');

// Parse command line arguments
function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            args[key] = value || true;
        }
    });
    return args;
}

// Validate required arguments
function validateArgs(args) {
    const required = ['api-url', 'env', 'dir'];
    const missing = required.filter(key => !args[key]);

    if (missing.length > 0) {
        console.error('❌ Missing required arguments:', missing.join(', '));
        console.error('\nUsage:');
        console.error('  yarn upload-planning-data --api-url=<URL> --env=<ENV> --dir=<DIR> --token=<TOKEN>');
        console.error('\nOptions:');
        console.error('  --api-url   (Required) Backend API URL (e.g., https://gatrix.example.com)');
        console.error('  --env       (Required) Target environment (dev, qa, production)');
        console.error('  --dir       (Required) Directory containing planning data files');
        console.error('  --token     (Required) API token for authentication');
        console.error('\nExample:');
        console.error('  yarn upload-planning-data --api-url=https://gatrix.motifgames.in --env=qa --dir=./planning-data --token=abc123');
        process.exit(1);
    }

    // Validate directory exists
    if (!fs.existsSync(args.dir)) {
        console.error(`❌ Directory not found: ${args.dir}`);
        process.exit(1);
    }

    return args;
}

// Get list of files in directory
function getFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.json5'))) {
            files.push(path.join(dir, entry.name));
        }
    }

    return files;
}

// Upload files to server
async function uploadFiles(apiUrl, env, files, token) {
    return new Promise((resolve, reject) => {
        const form = new FormData();

        // Add files
        files.forEach(filePath => {
            const fileName = path.basename(filePath);
            form.append('files', fs.createReadStream(filePath), fileName);
        });

        // Parse URL
        const url = new URL(`${apiUrl}/api/planning-data/upload`);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        // Set up headers
        const headers = {
            ...form.getHeaders(),
            'X-Environment': env,
            'X-API-Token': token,
        };

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers,
        };

        console.log(`📤 Uploading ${files.length} file(s) to ${apiUrl}...`);
        console.log(`   Environment: ${env}`);

        const req = lib.request(options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch {
                        resolve({ message: data });
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);

        form.pipe(req);
    });
}

// Main function
async function main() {
    console.log('🚀 Gatrix Planning Data Uploader\n');

    const args = validateArgs(parseArgs());

    const apiUrl = args['api-url'].replace(/\/$/, ''); // Remove trailing slash
    const env = args.env;
    const dir = args.dir;
    const token = args.token || process.env.GATRIX_API_TOKEN;

    // Validate token
    if (!token) {
        console.error('❌ API token is required for authentication.');
        console.error('   Provide --token=<YOUR_TOKEN> or set GATRIX_API_TOKEN environment variable.');
        process.exit(1);
    }

    // Get files
    const files = getFiles(dir);

    if (files.length === 0) {
        console.error(`❌ No JSON/JSON5 files found in: ${dir}`);
        process.exit(1);
    }

    console.log(`📁 Found ${files.length} file(s):`);
    files.forEach(f => console.log(`   - ${path.basename(f)}`));
    console.log();

    try {
        const result = await uploadFiles(apiUrl, env, files, token);
        console.log('\n✅ Upload successful!');
        if (result.message) {
            console.log(`   ${result.message}`);
        }
        if (result.uploadedFiles) {
            console.log(`   Files uploaded: ${result.uploadedFiles}`);
        }
    } catch (error) {
        console.error(`\n❌ Upload failed: ${error.message}`);
        process.exit(1);
    }
}

main();
