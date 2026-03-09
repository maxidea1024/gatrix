#!/usr/bin/env node

/**
 * Package deployment files into a .tgz archive
 * Includes deploy/ and docker/ directories with all config and credentials
 *
 * Usage: node package-deploy.js [--output <filename>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPLOY_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname);

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
const outputFile = outputName || `gatrix-deploy-${timestamp}.tgz`;
const outputPath = path.resolve(OUTPUT_DIR, outputFile);

// Files/directories to include (relative to project root)
const INCLUDE_ITEMS = [
  // Deploy folder
  'deploy/docker-stack.yml',
  'deploy/docker-stack.local.yml',
  'deploy/docker-stack.test.yml',
  'deploy/.env',
  'deploy/.env.example',
  'deploy/registry.env',
  'deploy/deploy.sh',
  'deploy/deploy.ps1',
  'deploy/login-registry.sh',
  'deploy/README.ko.md',
  'deploy/README.md',

  // Docker configs
  'docker/nginx/nginx.swarm.conf',
  'docker/nginx/ssl',
  'docker/mysql/init',
  'docker/mysql/conf.d',
  'docker/grafana/dashboards',
  'docker/grafana/provisioning',
  'docker/prometheus',
  'docker/loki',
];

console.log('Packaging Gatrix deployment files...\n');

// Collect existing files
const existingItems = [];
for (const item of INCLUDE_ITEMS) {
  const fullPath = path.join(ROOT_DIR, item);
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

// Build tar command
// Use tar with -C to set root directory, include files relative to root
const itemsArg = existingItems.map((item) => `"${item.replace(/\\/g, '/')}"`).join(' ');
const tarCmd = `tar -czf "${outputPath}" -C "${ROOT_DIR}" ${itemsArg}`;

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
  console.log(`\nTo extract on target server:`);
  console.log(`  tar -xzf ${outputFile}`);
  console.log(`  cd deploy`);
  console.log(`  # Edit .env and registry.env as needed`);
  console.log(`  docker swarm init`);
  console.log(`  docker stack deploy -c docker-stack.yml --with-registry-auth gatrix`);
} catch (err) {
  console.error('Failed to create archive:', err.message);
  process.exit(1);
}
