#!/usr/bin/env node

import { Command } from 'commander';
import { buildScanConfig, loadFlagDefinitions } from './config';
import { ScannerEngine } from './core/scannerEngine';
import { generateReports, determineExitCode } from './core/reporterEngine';
import { fetchFlagDefinitions } from './backend/client';
import { ReportFormat, DetectionMode } from './types';

// ============================================================
// CLI Entry Point - gatrix-flag-code-refs
// ============================================================

const VERSION = '1.0.0';

const program = new Command();

program
  .name('gatrix-flag-code-refs')
  .description(
    'Enterprise-Grade Multi-Language Feature Flag Static Analysis and Governance Platform',
  )
  .version(VERSION);

program
  .argument('[root]', 'Root directory to scan', '.')
  .option('--definitions <path>', 'Path to flag definitions JSON file')
  .option('--include <patterns...>', 'Glob patterns to include')
  .option('--exclude <patterns...>', 'Glob patterns to exclude')
  .option('--extensions <exts>', 'Comma-separated file extensions', parseCommaSeparated)
  .option('--languages <langs>', 'Comma-separated language filters', parseCommaSeparated)
  .option('--root <dir>', 'Root directory to scan')
  .option('--since <ref>', 'Git ref for incremental scanning (e.g., origin/main)')
  .option('--include-context', 'Include surrounding code context', false)
  .option('--context-lines <n>', 'Number of context lines', parseIntArg, 3)
  .option('--include-blame', 'Include git blame info', false)
  .option('--parallel <n>', 'Number of parallel workers', parseIntArg, 4)
  .option('--cache', 'Enable file hash caching', false)
  .option('--report <formats>', 'Report formats: console,json,html,sarif', parseCommaSeparated)
  .option('--output <path>', 'Output file path for report')
  .option('--ci', 'Enable CI mode (exit codes)', false)
  .option('--fail-on-warning', 'Fail on warnings in CI mode', false)
  .option('--strict-dynamic', 'Treat dynamic flag usage as error', false)
  .option('--report-backend', 'Upload report to Gatrix backend', false)
  .option('--backend-url <url>', 'Gatrix backend URL')
  .option('--api-key <key>', 'Gatrix API key')
  .option('--detection-mode <mode>', 'Detection mode: strict, balanced, aggressive')
  .option('--allow-global-lua-detection', 'Allow global Lua function calls', false)
  .option('--dry-run', 'Run scan without sending results to backend', false)
  .option('--include-tests', 'Include test files in scan (*.test.*, *.spec.*, __tests__)', false)
  .option('--lang <locale>', 'Report language: en (default), ko', 'en')
  .option(
    '--min-flag-key-length <n>',
    'Minimum flag key length (shorter keys are omitted)',
    parseIntArg,
    3,
  )
  .action(async (rootArg: string, options: Record<string, unknown>) => {
    try {
      await runScan(rootArg, options);
    } catch (err) {
      console.error('[FATAL]', err instanceof Error ? err.message : String(err));
      process.exit(2);
    }
  })
  .addHelpText(
    'after',
    `
Examples:
  # Discover all flag references (no definitions needed)
  $ gatrix-flag-code-refs --root ./src --detection-mode aggressive

  # Scan with flag validation
  $ gatrix-flag-code-refs --definitions ./flags.json --root ./src

  # CI mode with multiple report formats
  $ gatrix-flag-code-refs --definitions ./flags.json --ci --report console,json,sarif --output report.sarif

  # Incremental scan (only changed files since main)
  $ gatrix-flag-code-refs --definitions ./flags.json --since origin/main --ci

  # Dry run (preview without backend upload)
  $ gatrix-flag-code-refs --definitions ./flags.json --root ./src --dry-run

  # Scan specific languages only
  $ gatrix-flag-code-refs --root ./src --languages typescript,dart --detection-mode strict

  # Include code context and blame info
  $ gatrix-flag-code-refs --definitions ./flags.json --root ./src --include-context --context-lines 5 --include-blame

  # Upload results to Gatrix backend
  $ gatrix-flag-code-refs --definitions ./flags.json --root ./src --report-backend --backend-url https://api.gatrix.io --api-key YOUR_KEY
`,
  );

program.parse();

// ============================================================
// Main scan execution
// ============================================================

async function runScan(rootArg: string, options: Record<string, unknown>): Promise<void> {
  const root = (options.root as string) ?? rootArg ?? '.';

  // Build configuration from CLI options
  const config = buildScanConfig({
    root,
    definitions: options.definitions as string | undefined,
    include: options.include as string[] | undefined,
    exclude: options.exclude as string[] | undefined,
    extensions: options.extensions as string[] | undefined,
    languages: options.languages as string[] | undefined,
    since: options.since as string | undefined,
    includeContext: options.includeContext as boolean | undefined,
    contextLines: options.contextLines as number | undefined,
    includeBlame: options.includeBlame as boolean | undefined,
    parallel: options.parallel as number | undefined,
    cache: options.cache as boolean | undefined,
    report: (options.report as string[] | undefined)?.map((f) => f.trim() as ReportFormat),
    ci: options.ci as boolean | undefined,
    failOnWarning: options.failOnWarning as boolean | undefined,
    strictDynamic: options.strictDynamic as boolean | undefined,
    reportBackend: options.reportBackend as boolean | undefined,
    backendUrl: options.backendUrl as string | undefined,
    apiKey: options.apiKey as string | undefined,
    outputPath: options.output as string | undefined,
    detectionMode: options.detectionMode as DetectionMode | undefined,
    allowGlobalLuaDetection: options.allowGlobalLuaDetection as boolean | undefined,
    dryRun: options.dryRun as boolean | undefined,
    minFlagKeyLength: options.minFlagKeyLength as number | undefined,
  });

  // If --include-tests, remove test file patterns from exclude list
  if (options.includeTests) {
    const testPatterns = ['**/*.test.*', '**/*.spec.*', '**/__tests__/**'];
    config.exclude = config.exclude.filter((p) => !testPatterns.includes(p));
  }

  // Load flag definitions
  let definitions: ReturnType<typeof loadFlagDefinitions>;
  if (config.definitions) {
    // Local definitions file provided
    definitions = loadFlagDefinitions(config.definitions);
    const flagCount = Object.keys(definitions.flags).length;
    console.log(`[INFO] Loaded ${flagCount} flag definitions from ${config.definitions}`);
  } else if (config.backendUrl && config.apiKey) {
    // Fetch definitions from Gatrix backend
    try {
      console.log(`[INFO] Fetching flag definitions from ${config.backendUrl}...`);
      definitions = await fetchFlagDefinitions(config.backendUrl, config.apiKey);
      const flagCount = Object.keys(definitions.flags).length;
      console.log(`[INFO] Fetched ${flagCount} flag definitions from server.`);
    } catch (err) {
      console.warn(
        `[WARN] Failed to fetch flag definitions: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.warn('[WARN] Continuing scan without flag validation.');
      definitions = { flags: {} };
    }
  } else {
    definitions = { flags: {} };
    console.log('[INFO] No flag definitions provided. Scanning without validation.');
    console.log('[HINT] Use --definitions <path> or --backend-url + --api-key to enable validation.');
  }
  console.log(`[INFO] Detection mode: ${config.detectionMode}`);
  console.log(`[INFO] Scanning root: ${root}`);

  // Execute scan
  const engine = new ScannerEngine({ config, definitions });
  const report = await engine.execute();

  // Generate reports
  const locale = (options.lang as string) || 'en';
  await generateReports(report, config, locale);

  // Determine exit code for CI
  const exitCode = determineExitCode(report, config);
  if (exitCode !== 0) {
    console.error(`[CI] Exiting with code ${exitCode} due to detected issues.`);
  }
  process.exit(exitCode);
}

// ============================================================
// CLI argument parsers
// ============================================================

function parseCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseIntArg(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}
