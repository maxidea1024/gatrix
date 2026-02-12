import chalk from 'chalk';
import { ScanReport, FlagUsage, ValidationIssue } from '../types';

// ============================================================
// Console reporter - rich terminal output with confidence info
// ============================================================

/**
 * Print scan report to console with colors and formatting.
 */
export function reportToConsole(report: ScanReport): void {
  const { metadata, usages, summary } = report;

  // Header
  console.log('');
  console.log(chalk.bold.cyan('================================================================'));
  console.log(
    chalk.bold.cyan('  ') +
      chalk.bold.white('gatrix-flag-code-refs - Feature Flag Code Analysis Report'),
  );
  console.log(chalk.bold.cyan('================================================================'));
  console.log('');

  // Metadata
  console.log(chalk.bold.white('[Metadata]'));
  console.log(chalk.gray(`   Repository:  ${metadata.repository}`));
  console.log(chalk.gray(`   Branch:      ${metadata.branch}`));
  console.log(chalk.gray(`   Commit:      ${metadata.commit.slice(0, 8)}`));
  console.log(chalk.gray(`   Scan Time:   ${metadata.scanTime}`));
  console.log(chalk.gray(`   Version:     ${metadata.toolVersion}`));
  console.log('');

  // Summary
  console.log(chalk.bold.white('[Summary]'));
  console.log(chalk.gray(`   Files Scanned: ${summary.totalFilesScanned}`));
  console.log(chalk.gray(`   Total Usages:  ${summary.totalUsages}`));
  if (summary.errors > 0) {
    console.log(chalk.red(`   Errors:        ${summary.errors}`));
  } else {
    console.log(chalk.green(`   Errors:        ${summary.errors}`));
  }
  if (summary.warnings > 0) {
    console.log(chalk.yellow(`   Warnings:      ${summary.warnings}`));
  } else {
    console.log(chalk.green(`   Warnings:      ${summary.warnings}`));
  }
  console.log('');

  // Confidence distribution
  printConfidenceDistribution(usages);

  // Usages with issues
  const usagesWithIssues = usages.filter((u) => u.validation.length > 0);

  if (usagesWithIssues.length > 0) {
    console.log(chalk.bold.white(`[Issues] (${usagesWithIssues.length})`));
    console.log('');

    for (const usage of usagesWithIssues) {
      printUsageIssue(usage);
    }
  } else {
    console.log(chalk.bold.green('No issues found.'));
  }

  // Unused flags
  if (summary.unusedFlags.length > 0) {
    console.log('');
    console.log(chalk.bold.yellow(`[Unused Flags] (${summary.unusedFlags.length})`));
    for (const flag of summary.unusedFlags) {
      console.log(chalk.yellow(`   - ${flag}`));
    }
  }

  // Omitted short flag keys
  if (summary.omittedShortFlagKeys.length > 0) {
    console.log('');
    console.log(
      chalk.gray(
        `[Short Keys Omitted] ${summary.omittedShortFlagKeys.length} flag key(s) shorter than minimum length: ${summary.omittedShortFlagKeys.join(', ')}`,
      ),
    );
  }

  // Truncated files
  if (summary.truncatedFiles > 0) {
    console.log('');
    console.log(
      chalk.gray(`[Line Truncation] ${summary.truncatedFiles} file(s) had long lines truncated.`),
    );
  }

  console.log('');
  console.log(chalk.gray('-'.repeat(62)));
  console.log('');
}

/**
 * Print confidence score distribution.
 */
function printConfidenceDistribution(usages: FlagUsage[]): void {
  if (usages.length === 0) return;

  const high = usages.filter((u) => u.confidenceScore >= 80).length;
  const medium = usages.filter((u) => u.confidenceScore >= 50 && u.confidenceScore < 80).length;
  const low = usages.filter((u) => u.confidenceScore < 50).length;

  console.log(chalk.bold.white('[Confidence Distribution]'));
  console.log(chalk.green(`   High (>=80):    ${high}`));
  console.log(chalk.yellow(`   Medium (50-79): ${medium}`));
  console.log(chalk.red(`   Low (<50):      ${low}`));

  // Tier distribution
  const tier1 = usages.filter((u) => u.languageTier === 1).length;
  const tier2 = usages.filter((u) => u.languageTier === 2).length;
  const tier3 = usages.filter((u) => u.languageTier === 3).length;

  if (tier1 + tier2 + tier3 > 0) {
    console.log('');
    console.log(chalk.bold.white('[Tier Distribution]'));
    if (tier1 > 0) console.log(chalk.cyan(`   Tier 1 (AST+Type): ${tier1}`));
    if (tier2 > 0) console.log(chalk.blue(`   Tier 2 (Moderate):  ${tier2}`));
    if (tier3 > 0) console.log(chalk.magenta(`   Tier 3 (Pattern):   ${tier3}`));
  }

  console.log('');
}

/**
 * Print a single usage issue.
 */
function printUsageIssue(usage: FlagUsage): void {
  const locationStr = `${usage.filePath}:${usage.line}:${usage.column}`;
  const confidenceColor =
    usage.confidenceScore >= 80
      ? chalk.green
      : usage.confidenceScore >= 50
        ? chalk.yellow
        : chalk.red;

  console.log(
    chalk.bold(`  ${usage.flagName}`) +
      chalk.gray(` at ${locationStr}`) +
      confidenceColor(` [confidence: ${usage.confidenceScore}]`) +
      chalk.gray(` [tier: ${usage.languageTier}]`),
  );
  console.log(
    chalk.gray(`  ${usage.methodName}() [${usage.language}] strategy: ${usage.detectionStrategy}`),
  );

  for (const issue of usage.validation) {
    printValidationIssue(issue);
  }

  if (usage.codeUrl) {
    console.log(chalk.blue(`  Link: ${usage.codeUrl}`));
  }

  console.log('');
}

/**
 * Print a single validation issue with appropriate color.
 */
function printValidationIssue(issue: ValidationIssue): void {
  const prefix =
    issue.severity === 'error' ? 'ERROR' : issue.severity === 'warning' ? 'WARN' : 'INFO';
  const colorFn =
    issue.severity === 'error'
      ? chalk.red
      : issue.severity === 'warning'
        ? chalk.yellow
        : chalk.blue;

  console.log(colorFn(`  [${prefix}] [${issue.code}] ${issue.message}`));
  if (issue.suggestion) {
    console.log(chalk.gray(`     Hint: ${issue.suggestion}`));
  }
}
