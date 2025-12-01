#!/usr/bin/env node

/**
 * Deploy script for Gatrix
 * Exports specified branch as tgz and uploads to SFTP server
 *
 * Usage:
 *   yarn deploy:ftp [label] [--branch <branch>] [--local-only]
 *
 * Options:
 *   --branch, -b <branch>  Branch to export (default: main)
 *   --local-only           Create archive only, skip upload
 *
 * Example:
 *   yarn deploy:ftp cbt
 *   yarn deploy:ftp prod
 *   yarn deploy:ftp cbt --branch develop
 *   yarn deploy:ftp cbt -b feature/my-feature
 *   yarn deploy:ftp cbt --local-only
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

// Parse command line arguments
const args = process.argv.slice(2);
const localOnly = args.includes('--local-only');

// Parse --branch or -b option
let branch = 'main';
const branchIndex = args.findIndex(arg => arg === '--branch' || arg === '-b');
if (branchIndex !== -1 && args[branchIndex + 1]) {
    branch = args[branchIndex + 1];
}

// Get label (first non-option argument)
const label = args.find((arg, idx) => {
    // Skip if it's an option flag
    if (arg.startsWith('--') || arg === '-b') return false;
    // Skip if it's the value after --branch or -b
    if (idx > 0 && (args[idx - 1] === '--branch' || args[idx - 1] === '-b')) return false;
    return true;
}) || 'cbt';

console.log(`\n🚀 Starting deployment for label: ${label}`);
console.log(`🌿 Branch: ${branch}`);
if (localOnly) {
    console.log('📦 Local-only mode: Archive will be created without uploading\n');
} else {
    console.log('');
}

try {
    // 1. Get current commit hash (10 characters)
    console.log('📝 Getting commit hash...');
    const commitHash = execSync('git rev-parse --short=10 HEAD', { encoding: 'utf-8' }).trim();
    console.log(`   Commit: ${commitHash}`);

    // 2. Get current date and time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}${minute}${second}`;

    // 3. Create filename: uwo.{label}.YYYY-MM-DD.HHMMSS.{commit}.gatrix.tgz
    const filename = `uwo.${label}.${dateStr}.${timeStr}.${commitHash}.gatrix.tgz`;
    console.log(`📦 Package name: ${filename}`);

    // 4. Export specified branch as tar.gz
    console.log(`\n📤 Exporting branch '${branch}'...`);
    const tempDir = path.join(__dirname, '..', 'temp-export');

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const archivePath = path.join(tempDir, filename);

    // Use git archive to export specified branch
    execSync(`git archive --format=tar.gz --output="${archivePath}" ${branch}`, {
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

    // Check if ssh2-sftp-client is installed (local or global)
    let Client;
    try {
        Client = require('ssh2-sftp-client');
    } catch (e) {
        // Try global yarn packages
        try {
            const globalPath = execSync('yarn global dir', { encoding: 'utf8' }).trim();
            Client = require(require('path').join(globalPath, 'node_modules', 'ssh2-sftp-client'));
        } catch (e2) {
            console.error('\n❌ Error: ssh2-sftp-client is not installed');
            console.log('   Installing ssh2-sftp-client globally...\n');
            execSync('yarn global add ssh2-sftp-client', { stdio: 'inherit' });
            const globalPath = execSync('yarn global dir', { encoding: 'utf8' }).trim();
            Client = require(require('path').join(globalPath, 'node_modules', 'ssh2-sftp-client'));
        }
    }

    // Upload using ssh2-sftp-client
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

            // Upload file with progress using Transform stream
            const remoteFilePath = `${remoteLabelPath}/${filename}`;
            const fileSize = fs.statSync(archivePath).size;
            const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
            let transferred = 0;
            let lastPercent = -1;
            const startTime = Date.now();

            console.log(`📦 File size: ${fileSizeMB} MB`);
            process.stdout.write('⏳ Uploading: 0%');

            // Format seconds to mm:ss
            const formatTime = (seconds) => {
                if (!isFinite(seconds) || seconds < 0) return '--:--';
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            };

            // Create transform stream for progress tracking
            const { Transform } = require('stream');
            const progressStream = new Transform({
                transform(chunk, encoding, callback) {
                    transferred += chunk.length;
                    const percent = Math.floor((transferred / fileSize) * 100);
                    if (percent !== lastPercent) {
                        lastPercent = percent;

                        // Calculate speed and ETA
                        const elapsed = (Date.now() - startTime) / 1000;
                        const speed = transferred / elapsed;
                        const remaining = fileSize - transferred;
                        const eta = remaining / speed;
                        const speedMBps = (speed / 1024 / 1024).toFixed(2);

                        process.stdout.clearLine(0);
                        process.stdout.cursorTo(0);
                        const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
                        const transferredMB = (transferred / 1024 / 1024).toFixed(2);
                        process.stdout.write(`⏳ [${bar}] ${percent}% (${transferredMB}/${fileSizeMB} MB) ${speedMBps} MB/s ETA: ${formatTime(eta)}`);
                    }
                    callback(null, chunk);
                }
            });

            const readStream = fs.createReadStream(archivePath);
            const pipedStream = readStream.pipe(progressStream);

            await sftp.put(pipedStream, remoteFilePath);

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            console.log(`✅ File uploaded: ${remoteFilePath} (${totalTime}s)`);

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
