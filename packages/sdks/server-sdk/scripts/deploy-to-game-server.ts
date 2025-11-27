#!/usr/bin/env ts-node
/**
 * Deploy SDK to game server
 * 
 * Usage:
 *   yarn deploy:game          # Build, pack, and deploy to game server
 *   yarn deploy:game --bump   # Bump patch version before deploy
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const GAME_SERVER_LIB_PATH = 'c:/work/uwo/game/server/node/lib';
const GAME_SERVER_PATH = 'c:/work/uwo/game/server/node';

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
  const args = process.argv.slice(2);
  const shouldBump = args.includes('--bump');
  
  const sdkRoot = path.resolve(__dirname, '..');
  process.chdir(sdkRoot);
  
  console.log('='.repeat(60));
  console.log('🚀 Deploying SDK to Game Server');
  console.log('='.repeat(60));

  // 1. Bump version if requested
  if (shouldBump) {
    console.log('\n📦 Bumping patch version...');
    run('npm version patch --no-git-tag-version');
  }

  // 2. Get current version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const version = packageJson.version;
  console.log(`\n📌 Current version: ${version}`);

  // 3. Build
  console.log('\n🔨 Building SDK...');
  run('npm run build');

  // 4. Pack
  console.log('\n📦 Packing SDK...');
  run('npm pack');

  // 5. Find the generated tgz file
  const tgzFileName = `gatrix-server-sdk-${version}.tgz`;
  if (!fs.existsSync(tgzFileName)) {
    console.error(`❌ Pack file not found: ${tgzFileName}`);
    process.exit(1);
  }

  // 6. Check game server path exists
  if (!fs.existsSync(GAME_SERVER_LIB_PATH)) {
    console.error(`❌ Game server lib path not found: ${GAME_SERVER_LIB_PATH}`);
    process.exit(1);
  }

  // 7. Copy to game server
  console.log(`\n📋 Copying to game server: ${GAME_SERVER_LIB_PATH}`);
  const destPath = path.join(GAME_SERVER_LIB_PATH, tgzFileName);
  fs.copyFileSync(tgzFileName, destPath);
  console.log(`   ✓ Copied: ${tgzFileName}`);

  // 8. Update game server package.json
  const gamePackageJsonPath = path.join(GAME_SERVER_PATH, 'package.json');
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
  run('npm install', { cwd: GAME_SERVER_PATH });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ SDK v${version} deployed to game server successfully!`);
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('  1. cd c:/work/uwo/game/server/node');
  console.log('  2. npm run build');
  console.log('  3. Test the game server');
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err);
  process.exit(1);
});

