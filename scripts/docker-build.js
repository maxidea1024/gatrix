#!/usr/bin/env node
/**
 * Docker Build and Push Script for Tencent Cloud Registry
 * 
 * Features:
 * - Automatic version bumping (patch, minor, major)
 * - Multi-service Docker image building
 * - Push to Tencent Cloud Registry
 * 
 * Usage:
 *   yarn docker:build:prod [--bump patch|minor|major] [--push] [--service backend|frontend|event-lens|chat-server|edge|all]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REGISTRY = 'uwocn.tencentcloudcr.com';
const NAMESPACE = 'uwocn';
const IMAGE_NAME = 'uwocn';

// Services configuration with their Dockerfiles
const SERVICES = {
  backend: { dockerfile: 'packages/backend/Dockerfile', context: '.' },
  frontend: { dockerfile: 'packages/frontend/Dockerfile', context: '.' },
  'event-lens': { dockerfile: 'packages/event-lens/Dockerfile', context: '.' },
  'chat-server': { dockerfile: 'packages/chat-server/Dockerfile', context: '.' },
  edge: { dockerfile: 'packages/edge/Dockerfile', context: '.' },
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    bump: null,
    push: false,
    service: 'all',
    login: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bump':
      case '-b':
        options.bump = args[++i] || 'patch';
        break;
      case '--push':
      case '-p':
        options.push = true;
        break;
      case '--service':
      case '-s':
        options.service = args[++i] || 'all';
        break;
      case '--login':
      case '-l':
        options.login = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  return options;
}

// Show help message
function showHelp() {
  console.log(`
Docker Build and Push Script

Usage:
  yarn docker:build:prod [options]

Options:
  --bump, -b <type>     Version bump type: patch, minor, major (default: no bump)
  --push, -p            Push to Tencent Cloud Registry after building
  --service, -s <name>  Service to build: backend, frontend, event-lens, chat-server, edge, all (default: all)
  --login, -l           Login to registry before pushing
  --help, -h            Show this help message

Examples:
  yarn docker:build:prod                          # Build all services without version bump
  yarn docker:build:prod --bump patch --push      # Bump patch version, build and push
  yarn docker:build:prod -s backend -b minor -p   # Build only backend, bump minor, push
  `);
}

// Read current version from package.json
function getCurrentVersion() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

// Bump version
function bumpVersion(currentVersion, bumpType) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Update version in package.json
function updateVersion(newVersion) {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ Updated version to ${newVersion}`);
}

// Execute command with logging
function exec(command, options = {}) {
  console.log(`\n📦 Executing: ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    return false;
  }
}

// Login to registry
function loginToRegistry() {
  console.log('\n🔐 Logging in to Tencent Cloud Registry...');
  const loginCmd = `docker login ${REGISTRY} --username 100017829504 --password eyJhbGciOiJSUzI1NiIsImtpZCI6IkdDTzU6Q0I2UjpaQzVEOlJISUo6WkJTRjpCUlpFOlk0Qkg6R1BJWDpJVUZMOklQS1k6M1RNNTpSQjJOIn0.eyJvd25lclVpbiI6IjMyNzAzMzIzNjIiLCJvcGVyYXRvclVpbiI6IjEwMDAxNzgyOTUwNCIsInRva2VuSWQiOiJkNHA1bTIzbDdhMzNxZzFnMG9mZyIsImV4cCI6MjA4MDI2Nzc4NCwibmJmIjoxNzY0OTA3Nzg0LCJpYXQiOjE3NjQ5MDc3ODR9.e7YpMUd3ui0bJGlpOdC3ABDq4OW6R0T5v05XDvmE2AqU3BzsZN36uoN0S5FTnpjrA-RnDtEOTgaJ8sVPM2nov4GgKekrtaTYhNn4zg4aejfnS2QsDJb-o7tKLpm2_2Ckw7MW-lKfNQb73ZJaQzjkZK7FwvjNExtn_Gp5C2tgLr0DkJZTVSvfPfxeyvkJXQKL-KoKs2A3oyAxdqdsVUTT0viLvulTapFab47ciLsMaY_GW2BBLAI-DGSDeVKOh0Qm0FNVnEl5uVzSkJvU8Dc6vBfsOyj4_yhrNLiTsgfyHVsZ-oSCKPBS2C_uWqlDR6mKeq_9aH5rTX6eqNqIaybq6A`;
  return exec(loginCmd);
}

// Build Docker image for a service
function buildImage(serviceName, version) {
  const service = SERVICES[serviceName];
  if (!service) {
    console.error(`❌ Unknown service: ${serviceName}`);
    return false;
  }

  const fullImageName = `${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}`;
  const tag = `${serviceName}-${version}`;
  const latestTag = `${serviceName}-latest`;

  console.log(`\n🔨 Building ${serviceName}...`);
  const buildCmd = `docker build -f ${service.dockerfile} -t ${fullImageName}:${tag} -t ${fullImageName}:${latestTag} ${service.context}`;
  return exec(buildCmd);
}

// Push Docker image
function pushImage(serviceName, version) {
  const fullImageName = `${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}`;
  const tag = `${serviceName}-${version}`;
  const latestTag = `${serviceName}-latest`;

  console.log(`\n📤 Pushing ${serviceName}...`);
  if (!exec(`docker push ${fullImageName}:${tag}`)) return false;
  if (!exec(`docker push ${fullImageName}:${latestTag}`)) return false;
  return true;
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🚀 Docker Build Script for Tencent Cloud Registry');
  console.log('================================================\n');

  // Get current version
  let version = getCurrentVersion();
  console.log(`📌 Current version: ${version}`);

  // Bump version if requested
  if (options.bump) {
    version = bumpVersion(version, options.bump);
    updateVersion(version);
    console.log(`📌 New version: ${version}`);
  }

  // Determine services to build
  const servicesToBuild = options.service === 'all'
    ? Object.keys(SERVICES)
    : [options.service];

  // Login if pushing
  if (options.push || options.login) {
    if (!loginToRegistry()) {
      console.error('❌ Failed to login to registry');
      process.exit(1);
    }
  }

  // Build services
  console.log(`\n📦 Building services: ${servicesToBuild.join(', ')}`);

  for (const service of servicesToBuild) {
    if (!buildImage(service, version)) {
      console.error(`❌ Failed to build ${service}`);
      process.exit(1);
    }
  }

  // Push if requested
  if (options.push) {
    console.log('\n📤 Pushing images to registry...');
    for (const service of servicesToBuild) {
      if (!pushImage(service, version)) {
        console.error(`❌ Failed to push ${service}`);
        process.exit(1);
      }
    }
  }

  // Print summary
  console.log('\n✅ Build completed successfully!');
  console.log('================================');
  console.log(`Version: ${version}`);
  console.log(`Services: ${servicesToBuild.join(', ')}`);
  console.log(`Registry: ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}`);

  if (options.push) {
    console.log('\n📋 Pushed images:');
    for (const service of servicesToBuild) {
      console.log(`  - ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}:${service}-${version}`);
      console.log(`  - ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}:${service}-latest`);
    }
  }

  console.log('\n🎉 Done!');
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

