#!/usr/bin/env node

/**
 * Deploy script for Gatrix
 * Exports main branch as tgz and uploads to SFTP server
 * 
 * Usage:
 *   yarn deploy:sftp [label] [--local-only]
 *   
 * Example:
 *   yarn deploy:sftp cbt
 *   yarn deploy:sftp prod
 *   yarn deploy:sftp cbt --local-only  # Create archive only, skip upload
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// SFTP Configuration
const SFTP_CONFIG = {
    protocol: 'SFTP',
    host: '43.135.7.155',
    port: 22,
    user: 'build1_dev',
    password: 'build1_dev@2024',
    basePath: '/build/03. server_packages'
};

// Get label from command line argument, default to 'cbt'
const args = process.argv.slice(2);
const localOnly = args.includes('--local-only');
const label = args.find(arg => !arg.startsWith('--')) || 'cbt';

console.log(`\n🚀 Starting deployment for label: ${label}`);
if (localOnly) {
    console.log('📦 Local-only mode: Archive will be created without uploading\n');
} else {
    console.log('');
}

try {
    // 1. Get current commit hash (6 characters)
    console.log('📝 Getting commit hash...');
    const commitHash = execSync('git rev-parse --short=6 HEAD', { encoding: 'utf-8' }).trim();
    console.log(`   Commit: ${commitHash}`);

    // 2. Get current date and time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const dateTime = `${year}${month}${day}-${hour}${minute}${second}`;

    // 3. Create filename: uwo.{label}.YYYYMMDD-HHMMSS.{commit}.tgz
    const filename = `uwo.${label}.${dateTime}.${commitHash}.tgz`;
    console.log(`📦 Package name: ${filename}`);

    // 4. Export main branch as tar.gz
    console.log('\n📤 Exporting main branch...');
    const tempDir = path.join(__dirname, '..', 'temp-export');

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const archivePath = path.join(tempDir, filename);

    // Use git archive to export main branch
    execSync(`git archive --format=tar.gz --output="${archivePath}" main`, {
        stdio: 'inherit'
    });

    console.log(`✅ Archive created: ${archivePath}`);

    // 5. Upload to SFTP (skip if --local-only)
    if (localOnly) {
        console.log(`\n✨ Local archive created successfully!\n`);
        console.log(`📦 Package: ${filename}`);
        console.log(`📍 Location: ${archivePath}\n`);
        return;
    }

    console.log(`\n🌐 Uploading to SFTP server...`);
    console.log(`   Host: ${SFTP_CONFIG.host}:${SFTP_CONFIG.port}`);
    console.log(`   User: ${SFTP_CONFIG.user}`);
    console.log(`   Path: ${SFTP_CONFIG.basePath}/${label}/`);

    // Check if ssh2-sftp-client is installed
    try {
        require.resolve('ssh2-sftp-client');
    } catch (e) {
        console.error('\n❌ Error: ssh2-sftp-client is not installed');
        console.log('   Installing ssh2-sftp-client...\n');
        execSync('yarn add -D ssh2-sftp-client', { stdio: 'inherit' });
    }

    // Upload using ssh2-sftp-client
    const Client = require('ssh2-sftp-client');
    const sftp = new Client();

    (async () => {
        try {
            await sftp.connect({
                host: SFTP_CONFIG.host,
                port: SFTP_CONFIG.port,
                username: SFTP_CONFIG.user,
                password: SFTP_CONFIG.password
            });

            console.log('✅ Connected to SFTP server');

            // Create label directory if it doesn't exist
            const remoteLabelPath = `${SFTP_CONFIG.basePath}/${label}`;
            try {
                await sftp.mkdir(remoteLabelPath, true);
                console.log(`✅ Directory ensured: ${remoteLabelPath}`);
            } catch (err) {
                // Directory might already exist, ignore error
                if (!err.message.includes('File exists')) {
                    throw err;
                }
            }

            // Upload file
            const remoteFilePath = `${remoteLabelPath}/${filename}`;
            await sftp.put(archivePath, remoteFilePath);

            console.log(`✅ File uploaded: ${remoteFilePath}`);

            await sftp.end();

            // Clean up temp file
            fs.unlinkSync(archivePath);
            console.log('🧹 Cleaned up temporary files');

            console.log(`\n✨ Deployment completed successfully!\n`);
            console.log(`📦 Package: ${filename}`);
            console.log(`📍 Location: ${remoteFilePath}\n`);

        } catch (err) {
            console.error('\n❌ SFTP Error:', err.message);
            process.exit(1);
        }
    })();

} catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
}
