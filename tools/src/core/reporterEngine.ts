import { ScanConfig, ScanReport, ReportFormat } from '../types';
import { reportToConsole } from '../reporters/consoleReporter';
import { reportToJson } from '../reporters/jsonReporter';
import { reportToHtml } from '../reporters/htmlReporter';
import { reportToSarif } from '../reporters/sarifReporter';
import { uploadReport } from '../backend/client';

// ============================================================
// Reporter Engine
// Routes output to configured reporters and handles CI exit codes
// ============================================================

/**
 * Generate all configured reports.
 */
export async function generateReports(
  report: ScanReport,
  config: ScanConfig,
  locale?: string,
): Promise<void> {
  for (const format of config.report) {
    await generateSingleReport(report, format, config, locale);
  }

  if (config.reportBackend) {
    await reportToBackend(report, config);
  }
}

async function generateSingleReport(
  report: ScanReport,
  format: ReportFormat,
  config: ScanConfig,
  locale?: string,
): Promise<void> {
  switch (format) {
    case 'console':
      reportToConsole(report);
      break;
    case 'json': {
      const jsonPath = config.outputPath ?? 'gatrix-flag-report.json';
      reportToJson(report, jsonPath);
      break;
    }
    case 'html': {
      const htmlPath = config.outputPath ?? 'gatrix-flag-report.html';
      const htmlLocale = (locale === 'ko' ? 'ko' : 'en') as 'en' | 'ko';
      reportToHtml(report, htmlPath, htmlLocale);
      break;
    }
    case 'sarif': {
      const sarifPath = config.outputPath ?? 'gatrix-flag-report.sarif';
      reportToSarif(report, sarifPath);
      break;
    }
  }
}

async function reportToBackend(report: ScanReport, config: ScanConfig): Promise<void> {
  if (!config.backendUrl || !config.apiKey) {
    console.error('[ERROR] --backend-url and --api-key are required for backend reporting.');
    return;
  }

  console.log(`[INFO] Uploading report to ${config.backendUrl}...`);
  const result = await uploadReport(config.backendUrl, config.apiKey, report);

  if (result.success) {
    console.log(`[INFO] ${result.message}`);
  } else {
    console.error(`[ERROR] ${result.message}`);
  }
}

/**
 * Determine CI exit code with tier-aware logic.
 *
 * Tier 1 & 2: errors → exit(1)
 * Tier 3: only fail if --fail-on-warning or explicit config
 * Confidence-aware: low-confidence errors on Tier 3 are warnings
 */
export function determineExitCode(report: ScanReport, config: ScanConfig): number {
  if (!config.ci) return 0;

  // Count errors by tier
  let tier1or2Errors = 0;
  let tier3Errors = 0;
  let totalWarnings = 0;

  for (const usage of report.usages) {
    for (const v of usage.validation) {
      if (v.severity === 'error') {
        if (usage.languageTier <= 2) {
          tier1or2Errors++;
        } else {
          tier3Errors++;
        }
      }
      if (v.severity === 'warning') {
        totalWarnings++;
      }
    }
  }

  // Tier 1 & 2 errors always fail
  if (tier1or2Errors > 0) return 1;

  // Tier 3 errors only fail if explicitly configured
  if (tier3Errors > 0 && config.failOnWarning) return 1;

  // Warnings fail if --fail-on-warning
  if (config.failOnWarning && totalWarnings > 0) return 1;

  return 0;
}
