#!/usr/bin/env node

/**
 * CLI tool for uploading planning data to a remote Gatrix server.
 *
 * Usage:
 *   yarn upload-planning-data --api-url=https://gatrix.example.com --dir=./planning-data --token=<TOKEN>
 *
 * Options:
 *   --api-url   (Required) Backend API URL (e.g., https://gatrix.example.com)
 *   --dir       (Required) Directory containing planning data files
 *   --token     (Required) Server API token for authentication. Can also use GATRIX_API_TOKEN env var.
 *               Alias: --api-token (for backward compatibility)
 *   --uploader  (Optional) Override uploader name (e.g., "Jenkins CI", "Build Server")
 *   --comment   (Optional) Upload comment/description
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
            const [key, ...valueParts] = arg.substring(2).split('=');
            args[key] = valueParts.join('=') || true;
        }
    });
    return args;
}

// Validate required arguments
function validateArgs(args) {
    // Normalize aliases: --api-token → --token (backward compatibility)
    if (args['api-token'] && !args.token) {
        args.token = args['api-token'];
    }

    // Default dir if not provided
    if (!args.dir) {
        args.dir = path.resolve(process.cwd(), 'converted-planning-data');
    }

    const required = ['api-url'];
    const missing = required.filter(key => !args[key]);

    if (missing.length > 0) {
        console.error('❌ Missing required arguments:', missing.join(', '));
        console.error('\nUsage:');
        console.error('  yarn upload-planning-data --api-url=<URL> --dir=<DIR> --token=<TOKEN> [--uploader=<NAME>] [--comment=<TEXT>]');
        console.error('\nOptions:');
        console.error('  --api-url   (Required) Backend API URL (e.g., https://gatrix.example.com)');
        console.error('  --dir       (Optional) Directory containing planning data files (default: ./converted-planning-data)');
        console.error('  --token     (Required) Server API token for authentication');
        console.error('  --uploader  (Optional) Override uploader name (e.g., "Jenkins CI")');
        console.error('  --comment   (Optional) Upload comment/description');
        console.error('\nExample:');
        console.error('  yarn upload-planning-data --api-url=https://gatrix.example.com --dir=./planning-data --token=abc123 --uploader="Jenkins CI" --comment="Automated build #123"');
        process.exit(1);
    }

    // Workaround for Jenkins pipeline mismatch: convert uses ./converted-planning-data but upload uses ./output
    const convertedPath = path.resolve(process.cwd(), 'converted-planning-data');
    if (args.dir.endsWith('output') && fs.existsSync(convertedPath)) {
        console.log('⚠️ Jenkins pipeline mismatch detected! Using ./converted-planning-data instead of ./output');
        args.dir = convertedPath;
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
async function uploadFiles(apiUrl, files, token, uploader, comment) {
    return new Promise((resolve, reject) => {
        const form = new FormData();

        // Add files
        files.forEach(filePath => {
            const fileName = path.basename(filePath);
            form.append('files', fs.createReadStream(filePath), fileName);
        });

        // Add optional metadata
        if (comment) {
            form.append('comment', comment);
        }

        // Parse URL - environment is determined by API token, not URL path
        const url = new URL(`${apiUrl}/api/v1/server/planning-data/upload`);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        // Set up headers
        const headers = {
            ...form.getHeaders(),
            'X-API-Token': token,
            'X-Application-Name': 'gatrix-cli',
        };

        // Add uploader override header if provided
        if (uploader) {
            headers['X-Uploader-Name'] = uploader;
        }

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers,
        };

        console.log(`📤 Uploading ${files.length} file(s) to ${apiUrl}...`);
        console.log(`   API Endpoint: ${url.pathname}`);
        if (uploader) {
            console.log(`   Uploader: ${uploader}`);
        }
        if (comment) {
            console.log(`   Comment: ${comment}`);
        }

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
    const dir = args.dir;
    const token = args.token || process.env.GATRIX_API_TOKEN;
    const uploader = args.uploader;
    const comment = args.comment;

    // Validate token
    if (!token) {
        console.error('❌ Server API token is required for authentication.');
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
        const result = await uploadFiles(apiUrl, files, token, uploader, comment);
        console.log('\n✅ Upload successful!');
        if (result.message) {
            console.log(`   ${result.message}`);
        }
        if (result.data?.stats) {
            const stats = result.data.stats;
            console.log(`   Files uploaded: ${stats.filesUploaded}`);
            console.log(`   Upload hash: ${stats.uploadHash}`);
            if (stats.changedFilesCount > 0) {
                console.log(`   Changed files: ${stats.changedFilesCount}`);
            }
        }
    } catch (error) {
        console.error(`\n❌ Upload failed: ${error.message}`);
        process.exit(1);
    }
}

main();
