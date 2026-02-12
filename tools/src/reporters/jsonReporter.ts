import * as fs from 'fs';
import * as path from 'path';
import { ScanReport } from '../types';

// ============================================================
// JSON reporter - structured JSON output for CI/CD
// ============================================================

/**
 * Write scan report as JSON to a file.
 */
export function reportToJson(report: ScanReport, outputPath?: string): string {
  const json = JSON.stringify(report, null, 2);

  if (outputPath) {
    const resolved = path.resolve(outputPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, json, 'utf-8');
    console.log(`[INFO] JSON report saved to: ${resolved}`);
  }

  return json;
}
