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
      if (
        nextArg &&
        !nextArg.startsWith('--') &&
        /^\d+\.\d+\.\d+/.test(nextArg)
      ) {
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
    cwd: options?.cwd,
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
      // Yarn Berry doesn't support --new-version; update package.json directly
      const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      pkgJson.version = options.version;
      fs.writeFileSync('package.json', JSON.stringify(pkgJson, null, 2) + '\n');
      console.log(`   ✓ Version set to ${options.version}`);
    } else {
      console.log('\n📦 Bumping patch version...');
      // Yarn Berry syntax: `yarn version patch` (not --patch)
      run('yarn version patch --immediate');
    }
  }

  // 2. Get current version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const version = packageJson.version;
  console.log(`\n📌 Current version: ${version}`);

  // 3. Build
  console.log('\n🔨 Building SDK...');
  run('yarn build');

  // 4. Prepare @gatrix workspace packages for bundling (replace symlinks with actual files)
  console.log('\n📦 Preparing @gatrix workspace packages for bundling...');
  const gatrixNodeModulesPath = path.join(sdkRoot, 'node_modules', '@gatrix');
  const packagesRoot = path.resolve(sdkRoot, '..', '..', '..');

  // Workspace packages to bundle: [package name, source directory name]
  const workspacePackages = [
    { name: 'shared', sourcePath: path.join(packagesRoot, 'shared') },
    { name: 'evaluator', sourcePath: path.join(packagesRoot, 'evaluator') },
  ];

  for (const pkg of workspacePackages) {
    const destPath = path.join(gatrixNodeModulesPath, pkg.name);

    // Remove symlink and copy actual files
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true });
    }
    fs.mkdirSync(destPath, { recursive: true });

    // Copy dist and package.json
    const distSrc = path.join(pkg.sourcePath, 'dist');
    if (fs.existsSync(distSrc)) {
      execSync(`xcopy /E /I /Y "${distSrc}" "${destPath}\\dist"`, {
        encoding: 'utf-8',
      });
    } else {
      console.warn(
        `   ⚠ No dist/ found for @gatrix/${pkg.name}, skipping dist copy`
      );
    }
    fs.copyFileSync(
      path.join(pkg.sourcePath, 'package.json'),
      path.join(destPath, 'package.json')
    );
    console.log(`   ✓ Copied @gatrix/${pkg.name} to node_modules`);
  }

  // 5. Pack (using npm pack since it properly handles bundledDependencies)
  console.log('\n📦 Packing SDK...');
  const tgzFileName = `gatrix-gatrix-node-server-sdk-${version}.tgz`;
  run(`npm pack --pack-destination .`);
  if (!fs.existsSync(tgzFileName)) {
    console.error(`❌ Pack file not found: ${tgzFileName}`);
    process.exit(1);
  }

  // 5.5. Remove all workspace:* dependencies from the packed tgz (they are bundled)
  console.log('\n🔧 Removing workspace dependencies from tgz...');
  const tempDir = path.join(sdkRoot, '.temp-deploy');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Extract tgz
  execSync(`tar -xzf ${tgzFileName} -C ${tempDir}`, { encoding: 'utf-8' });

  // Modify package.json inside the extracted package
  const extractedPkgJsonPath = path.join(tempDir, 'package', 'package.json');
  const sdkPkgJson = JSON.parse(fs.readFileSync(extractedPkgJsonPath, 'utf-8'));
  if (sdkPkgJson.dependencies) {
    const removed: string[] = [];
    for (const [dep, ver] of Object.entries(sdkPkgJson.dependencies)) {
      if (typeof ver === 'string' && ver.startsWith('workspace:')) {
        delete sdkPkgJson.dependencies[dep];
        removed.push(dep);
      }
    }
    if (removed.length > 0) {
      fs.writeFileSync(
        extractedPkgJsonPath,
        JSON.stringify(sdkPkgJson, null, 2) + '\n'
      );
      console.log(`   ✓ Removed workspace deps: ${removed.join(', ')}`);
    }
  }

  // Re-pack the tgz
  fs.unlinkSync(tgzFileName);
  execSync(`tar -czf ${tgzFileName} -C ${tempDir} package`, {
    encoding: 'utf-8',
  });
  fs.rmSync(tempDir, { recursive: true });
  console.log('   ✓ Re-packed SDK tgz');

  // Note: @gatrix/shared is now a copied directory instead of symlink.
  // It will be restored to symlink on next 'yarn install' in this folder.

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

  // 7. Copy SDK to game server (includes @gatrix/shared via bundledDependencies)
  console.log(`\n📋 Copying SDK to game server: ${gameServerLibPath}`);
  const destPath = path.join(gameServerLibPath, tgzFileName);
  fs.copyFileSync(tgzFileName, destPath);
  console.log(`   ✓ Copied: ${tgzFileName}`);

  // 8. Update game server package.json
  const gamePackageJsonPath = path.join(gameServerPath, 'package.json');
  if (fs.existsSync(gamePackageJsonPath)) {
    console.log('\n📝 Updating game server package.json...');
    const gamePackageJson = JSON.parse(
      fs.readFileSync(gamePackageJsonPath, 'utf-8')
    );

    if (gamePackageJson.dependencies) {
      // Update gatrix-server-sdk
      const oldSdkDep =
        gamePackageJson.dependencies['@gatrix/gatrix-node-server-sdk'] ||
        gamePackageJson.dependencies['gatrix-node-server-sdk'];
      const newSdkDep = `file:./lib/${tgzFileName}`;
      gamePackageJson.dependencies['@gatrix/gatrix-node-server-sdk'] =
        newSdkDep;
      if (gamePackageJson.dependencies['gatrix-node-server-sdk']) {
        delete gamePackageJson.dependencies['gatrix-node-server-sdk'];
      }
      if (gamePackageJson.dependencies['gatrix-server-sdk']) {
        delete gamePackageJson.dependencies['gatrix-server-sdk'];
      }
      console.log(`   ✓ SDK: ${oldSdkDep || '(new)'} → ${newSdkDep}`);

      // Remove @gatrix/shared if exists (now bundled in SDK)
      if (gamePackageJson.dependencies['@gatrix/shared']) {
        delete gamePackageJson.dependencies['@gatrix/shared'];
        console.log('   ✓ Removed @gatrix/shared (now bundled in SDK)');
      }

      fs.writeFileSync(
        gamePackageJsonPath,
        JSON.stringify(gamePackageJson, null, 2) + '\n'
      );
    }
  }

  // 9. Clean up local tgz
  console.log('\n🧹 Cleaning up...');
  fs.unlinkSync(tgzFileName);
  console.log(`   ✓ Removed: ${tgzFileName}`);

  // 10. Skip auto-install, let user run manually
  console.log(
    '\n📋 Deployment complete. Run yarn install manually in game server.'
  );

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
