#!/usr/bin/env ts-node
/**
 * Deploy SDK to game server
 *
 * Usage:
 *   yarn deploy:game                     # Build, pack, and deploy to game server
 *   yarn deploy:game --bump              # Bump patch version before deploy
 *   yarn deploy:game --bump 1.2.3        # Set specific version before deploy
 *   yarn deploy:game --path /path/to/server  # Deploy to custom game server path
 *
 * Environment Variables:
 *   GAME_SERVER_PATH   # Default game server path (default: c:/work/uwo/game/server/node)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_GAME_SERVER_PATH = 'c:/work/uwo/game/server/node';

interface CliOptions {
  bump: boolean;
  version?: string;
  gameServerPath: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    bump: false,
    version: undefined,
    gameServerPath: process.env.GAME_SERVER_PATH || DEFAULT_GAME_SERVER_PATH,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--bump') {
      options.bump = true;
      // Check if next arg is a version number (not starting with --)
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--') && /^\d+\.\d+\.\d+/.test(nextArg)) {
        options.version = nextArg;
        i++; // Skip next arg
      }
    } else if (arg === '--path') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options.gameServerPath = nextArg;
        i++; // Skip next arg
      } else {
        console.error('❌ --path requires a path argument');
        process.exit(1);
      }
    }
  }

  return options;
}

function run(cmd: string, options?: { cwd?: string }): string {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, {
    encoding: 'utf-8',
    stdio: 'inherit',
    cwd: options?.cwd
  }) as unknown as string;
}

function runCapture(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function main() {
  const options = parseArgs();
  const gameServerPath = options.gameServerPath;
  const gameServerLibPath = path.join(gameServerPath, 'lib');

  const sdkRoot = path.resolve(__dirname, '..');
  process.chdir(sdkRoot);

  console.log('='.repeat(60));
  console.log('🚀 Deploying SDK to Game Server');
  console.log('='.repeat(60));
  console.log(`   Target: ${gameServerPath}`);

  // 1. Bump version if requested
  if (options.bump) {
    if (options.version) {
      console.log(`\n📦 Setting version to ${options.version}...`);
      run(`yarn version --new-version ${options.version} --no-git-tag-version`);
    } else {
      console.log('\n📦 Bumping patch version...');
      run('yarn version --patch --no-git-tag-version');
    }
  }

  // 2. Get current version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const version = packageJson.version;
  console.log(`\n📌 Current version: ${version}`);

  // 3. Build
  console.log('\n🔨 Building SDK...');
  run('yarn build');

  // 4. Pack
  console.log('\n📦 Packing SDK...');
  run('yarn pack --filename gatrix-server-sdk-' + version + '.tgz');

  // 5. Find the generated tgz file
  const tgzFileName = `gatrix-server-sdk-${version}.tgz`;
  if (!fs.existsSync(tgzFileName)) {
    console.error(`❌ Pack file not found: ${tgzFileName}`);
    process.exit(1);
  }

  // 6. Check game server path exists
  if (!fs.existsSync(gameServerPath)) {
    console.error(`❌ Game server path not found: ${gameServerPath}`);
    process.exit(1);
  }

  // Create lib folder if not exists
  if (!fs.existsSync(gameServerLibPath)) {
    console.log(`\n📁 Creating lib folder: ${gameServerLibPath}`);
    fs.mkdirSync(gameServerLibPath, { recursive: true });
  }

  // 7. Copy to game server
  console.log(`\n📋 Copying to game server: ${gameServerLibPath}`);
  const destPath = path.join(gameServerLibPath, tgzFileName);
  fs.copyFileSync(tgzFileName, destPath);
  console.log(`   ✓ Copied: ${tgzFileName}`);

  // 8. Update game server package.json
  const gamePackageJsonPath = path.join(gameServerPath, 'package.json');
  if (fs.existsSync(gamePackageJsonPath)) {
    console.log('\n📝 Updating game server package.json...');
    const gamePackageJson = JSON.parse(fs.readFileSync(gamePackageJsonPath, 'utf-8'));

    const oldDep = gamePackageJson.dependencies?.['gatrix-server-sdk'];
    const newDep = `file:./lib/${tgzFileName}`;

    if (gamePackageJson.dependencies) {
      gamePackageJson.dependencies['gatrix-server-sdk'] = newDep;
      fs.writeFileSync(gamePackageJsonPath, JSON.stringify(gamePackageJson, null, 2) + '\n');
      console.log(`   ✓ Updated: ${oldDep} → ${newDep}`);
    }
  }

  // 9. Clean up local tgz
  console.log('\n🧹 Cleaning up...');
  fs.unlinkSync(tgzFileName);
  console.log(`   ✓ Removed: ${tgzFileName}`);

  // 10. Install in game server
  console.log('\n📥 Installing in game server...');
  run('yarn install', { cwd: gameServerPath });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ SDK v${version} deployed to game server successfully!`);
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log(`  1. cd ${gameServerPath}`);
  console.log('  2. yarn build');
  console.log('  3. Test the game server');
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err);
  process.exit(1);
});
