import chalk from 'chalk';
import { StaleFlagInfo, FlagRunStatus, OrchestratorSummary } from '../types';

// ============================================================
// Terminal display utilities
// ============================================================

const STATUS_ICONS: Record<FlagRunStatus, string> = {
  pending: '○',
  running: '▶',
  'pr-created': '✓',
  'no-changes': '○',
  skipped: '⊘',
  failed: '✗',
};

const STATUS_COLORS: Record<FlagRunStatus, (s: string) => string> = {
  pending: chalk.gray,
  running: chalk.blue,
  'pr-created': chalk.green,
  'no-changes': chalk.gray,
  skipped: chalk.yellow,
  failed: chalk.red,
};

/**
 * Print the current status of a single flag run.
 */
export function printFlagStatus(
  repo: string,
  flagKey: string,
  status: FlagRunStatus,
  prUrl?: string,
): void {
  const icon = STATUS_ICONS[status];
  const color = STATUS_COLORS[status];
  const label = color(`[${status}]`);
  const suffix = prUrl ? chalk.underline(` → ${prUrl}`) : '';
  console.log(`  ${icon} ${chalk.bold(repo)} / ${chalk.cyan(flagKey)} ${label}${suffix}`);
}

/**
 * Print a list of stale flags before the run begins.
 */
export function printStaleFlagList(flags: StaleFlagInfo[]): void {
  if (flags.length === 0) {
    console.log(chalk.green('✓ No stale flags found.'));
    return;
  }

  console.log(chalk.bold(`\nFound ${chalk.yellow(String(flags.length))} stale flag(s):\n`));

  const maxKeyLen = Math.max(10, ...flags.map((f) => f.key.length));

  console.log(
    chalk.bold('KEY'.padEnd(maxKeyLen + 2)) + chalk.bold('KEEP'.padEnd(12)) + chalk.bold('REASON'),
  );
  console.log('─'.repeat(maxKeyLen + 40));

  for (const flag of flags) {
    const keepLabel =
      flag.keepBranch === 'enabled' ? chalk.green('enabled') : chalk.red('disabled');
    console.log(
      chalk.cyan(flag.key.padEnd(maxKeyLen + 2)) + keepLabel.padEnd(22) + chalk.gray(flag.reason),
    );
  }
  console.log('');
}

/**
 * Print the orchestrator run summary.
 */
export function printSummary(summary: OrchestratorSummary): void {
  const { results } = summary;
  const prCreated = results.filter((r) => r.status === 'pr-created');
  const noChanges = results.filter((r) => r.status === 'no-changes');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');

  console.log('\n' + chalk.bold('═'.repeat(60)));
  console.log(chalk.bold('  Gatrix Stale Flag Cleaner – Run Complete'));
  console.log(chalk.bold('═'.repeat(60)));
  console.log(`  Total flags  : ${chalk.yellow(String(summary.totalFlags))}`);
  console.log(`  PRs created  : ${chalk.green(String(prCreated.length))}`);
  console.log(`  No changes   : ${chalk.gray(String(noChanges.length))}`);
  console.log(`  Skipped      : ${chalk.yellow(String(skipped.length))}`);
  console.log(`  Failed       : ${chalk.red(String(failed.length))}`);
  console.log(chalk.bold('═'.repeat(60)));

  if (prCreated.length > 0) {
    console.log(chalk.bold.green('\nPRs created:'));
    for (const r of prCreated) {
      console.log(`  • ${chalk.cyan(r.flag.key)} (${r.repo}): ${chalk.underline(r.prUrl ?? '')}`);
    }
  }

  if (failed.length > 0) {
    console.log(chalk.bold.red('\nFailed:'));
    for (const r of failed) {
      console.log(`  ✗ ${chalk.cyan(r.flag.key)} (${r.repo}): ${chalk.gray(r.error ?? '')}`);
    }
  }
  console.log('');
}

/**
 * Print JSON to stdout.
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print an error message.
 */
export function printError(message: string): void {
  console.error(chalk.red(`[ERROR] ${message}`));
}

/**
 * Print an informational message.
 */
export function printInfo(message: string): void {
  console.log(chalk.blue(`[INFO] ${message}`));
}
