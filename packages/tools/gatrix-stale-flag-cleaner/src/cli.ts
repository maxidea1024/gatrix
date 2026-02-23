#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import { fetchStaleFlags } from './fetcher/gatrixFetcher';
import { loadFlagsFromFile } from './fetcher/manualFetcher';
import { loadConfig } from './config/loader';
import { runOrchestrator } from './orchestrator/orchestrator';
import {
  printStaleFlagList,
  printSummary,
  printJson,
  printError,
  printInfo,
} from './utils/display';
import { StaleFlagInfo } from './types';

// ============================================================
// CLI Entry Point - gatrix-stale-flag-cleaner
// ============================================================

const VERSION = '1.0.0';

const program = new Command();

program
  .name('gatrix-stale-flag-cleaner')
  .description(
    'Fetch stale feature flags from Gatrix and automatically remove them\n' +
      'from your codebase via an AI agent, then open a draft PR.',
  )
  .version(VERSION);

// ============================================================
// run command - fetch + AI cleanup + PR (main workflow)
// ============================================================

program
  .command('run')
  .description(
    'Fetch stale flags from the Gatrix backend (or a local file), ' +
      'run an AI agent to remove them, and open draft PRs.',
  )
  .requiredOption('--target-repos <path>', 'Path to the directory containing repos + config file')
  .option('--backend-url <url>', 'Gatrix backend URL (overrides config)')
  .option('--api-key <key>', 'Gatrix server API key (overrides config)')
  .option('--input <file>', 'Read stale flags from a JSON file instead of the backend')
  .option('--stale-days <n>', 'Days since last update to consider stale', parseIntArg, 30)
  .option('--dry-run', 'Preview what would happen without creating PRs or running agents', false)
  .option('--json', 'Print final summary as JSON', false)
  .action(async (opts: RunOptions) => {
    try {
      const config = loadConfig(opts.targetRepos);
      const flags = await resolveFlags(opts);

      if (flags.length === 0) {
        printInfo('No stale flags found. Nothing to do.');
        return;
      }

      printStaleFlagList(flags);

      if (opts.dryRun) {
        printInfo('[dry-run] Would process the above flags. No agents will be run.');
        return;
      }

      const summary = await runOrchestrator({
        flags,
        config,
        targetReposDir: opts.targetRepos,
        dryRun: opts.dryRun,
      });

      if (opts.json) {
        printJson(summary);
      } else {
        printSummary(summary);
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ============================================================
// fetch command - just list stale flags, no agent
// ============================================================

program
  .command('fetch')
  .description('Fetch stale flags from the Gatrix backend and print them (no agent run)')
  .requiredOption('--backend-url <url>', 'Gatrix backend URL')
  .requiredOption('--api-key <key>', 'Gatrix server API key')
  .option('--stale-days <n>', 'Days since last update to consider stale', parseIntArg, 30)
  .option('--output <file>', 'Write results to a JSON file')
  .option('--json', 'Output as JSON', false)
  .action(async (opts: FetchOptions) => {
    try {
      printInfo(`Fetching stale flags from ${opts.backendUrl}...`);
      const flags = await fetchStaleFlags(opts.backendUrl, opts.apiKey, opts.staleDays);

      if (opts.output) {
        fs.writeFileSync(opts.output, JSON.stringify(flags, null, 2), 'utf-8');
        printInfo(`Wrote ${flags.length} stale flag(s) to ${opts.output}`);
      } else if (opts.json) {
        printJson(flags);
      } else {
        printStaleFlagList(flags);
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();

// ============================================================
// Helpers
// ============================================================

async function resolveFlags(opts: RunOptions): Promise<StaleFlagInfo[]> {
  if (opts.input) {
    printInfo(`Loading stale flags from ${opts.input}...`);
    return loadFlagsFromFile(opts.input);
  }

  if (opts.backendUrl && opts.apiKey) {
    printInfo(`Fetching stale flags from ${opts.backendUrl}...`);
    return fetchStaleFlags(opts.backendUrl, opts.apiKey, opts.staleDays);
  }

  // Fall back to config-level backend settings if provided via env
  const backendUrl = process.env.GATRIX_BACKEND_URL;
  const apiKey = process.env.GATRIX_API_KEY;
  if (backendUrl && apiKey) {
    printInfo(`Fetching stale flags from ${backendUrl} (via env)...`);
    return fetchStaleFlags(backendUrl, apiKey, opts.staleDays);
  }

  throw new Error(
    'No flag source provided.\n' +
      'Use --input <file>, --backend-url + --api-key, or set GATRIX_BACKEND_URL / GATRIX_API_KEY env vars.',
  );
}

function parseIntArg(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer: ${value}`);
  return parsed;
}

// ============================================================
// Option type definitions
// ============================================================

interface RunOptions {
  targetRepos: string;
  backendUrl?: string;
  apiKey?: string;
  input?: string;
  staleDays: number;
  dryRun: boolean;
  json: boolean;
}

interface FetchOptions {
  backendUrl: string;
  apiKey: string;
  staleDays: number;
  output?: string;
  json: boolean;
}
