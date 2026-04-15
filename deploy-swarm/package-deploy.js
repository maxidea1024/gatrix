#!/usr/bin/env node

/**
 * Package deployment files into a .tgz archive
 * Self-contained: includes all config files needed for deployment
 *
 * Usage: node package-deploy.js [--output <filename>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEPLOY_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, 'dist');

// Parse arguments
const args = process.argv.slice(2);
let outputName = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    outputName = args[i + 1];
    break;
  }
}

// Generate output filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputFile = outputName || `gatrix-swarm-deploy-${timestamp}.tgz`;
const outputPath = path.resolve(OUTPUT_DIR, outputFile);

// Files/directories to include (relative to deploy-swarm directory)
const INCLUDE_ITEMS = [
  // Stack definition
  'docker-compose.swarm.yml',

  // Environment
  '.env.example',
  '.gitignore',

  // Config files (self-contained)
  'config/nginx.conf',
  'config/prometheus.yml',
  'config/grafana/provisioning/datasources/datasource.yml',
  'config/grafana/provisioning/dashboards/dashboards.yml',

  // Deploy scripts
  'deploy.sh',
  'deploy.ps1',

  // Login scripts
  'login-registry.sh',
  'login-registry.ps1',

  // Operational scripts
  'update.sh',
  'update.ps1',
  'rollback.sh',
  'rollback.ps1',
  'ephemeral-scale.sh',
  'ephemeral-scale.ps1',
  'status.sh',
  'status.ps1',
  'list-images.sh',
  'list-images.ps1',
  'teardown.sh',
  'teardown.ps1',
  'health-check.sh',
  'health-check.ps1',
  'generate-secrets.sh',
  'generate-secrets.ps1',
  'package.sh',
  'package.ps1',

  // Documentation
  'README.md',
  'README.en.md',
  'README.zh.md',
];

console.log('Packaging Gatrix Swarm deployment files...\n');

// Collect existing files
const existingItems = [];
for (const item of INCLUDE_ITEMS) {
  const fullPath = path.join(DEPLOY_DIR, item);
  if (fs.existsSync(fullPath)) {
    existingItems.push(item);
    const stat = fs.statSync(fullPath);
    const type = stat.isDirectory() ? '(dir)' : `(${(stat.size / 1024).toFixed(1)}KB)`;
    console.log(`  [+] ${item} ${type}`);
  } else {
    console.log(`  [-] ${item} (not found, skipping)`);
  }
}

if (existingItems.length === 0) {
  console.error('\nNo files found to package!');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Build tar command
const itemsArg = existingItems.map((item) => `"${item.replace(/\\/g, '/')}"`).join(' ');
const tarCmd = `tar -czf "${outputPath}" -C "${DEPLOY_DIR}" ${itemsArg}`;

try {
  console.log(`\nCreating archive...`);
  execSync(tarCmd, { stdio: 'inherit' });

  const stat = fs.statSync(outputPath);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);

  console.log(`\n========================================`);
  console.log(`Archive created: ${outputFile}`);
  console.log(`Size: ${sizeMB} MB`);
  console.log(`Location: ${outputPath}`);
  console.log(`========================================`);
  console.log(`\nTo deploy on target server:`);
  console.log(`  1. tar -xzf ${outputFile}`);
  console.log(`  2. cp .env.example .env`);
  console.log(`  3. # Edit .env with your Cloud DB/Redis info`);
  console.log(`  4. # Create registry.env with Docker registry credentials`);
  console.log(`  5. ./generate-secrets.sh --env  # Generate security keys`);
  console.log(`  6. ./deploy.sh -v latest --init`);
} catch (err) {
  console.error('Failed to create archive:', err.message);
  process.exit(1);
}
