import * as fs from 'fs';
import * as path from 'path';
import { ScanReport } from '../types';

// ============================================================
// SARIF reporter - Static Analysis Results Interchange Format
// For integration with GitHub Advanced Security, VS Code, etc.
// ============================================================

/**
 * Generate a SARIF report from the scan results.
 */
export function reportToSarif(report: ScanReport, outputPath?: string): string {
  const sarifReport = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'gatrix-flag-code-refs',
            version: report.metadata.toolVersion,
            informationUri: 'https://github.com/gatrix/flag-code-refs',
            rules: getUniqueRules(report),
          },
        },
        results: report.usages
          .filter((u) => u.validation.length > 0)
          .flatMap((usage) =>
            usage.validation.map((v) => ({
              ruleId: v.code,
              level:
                v.severity === 'error' ? 'error' : v.severity === 'warning' ? 'warning' : 'note',
              message: {
                text: v.message,
              },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: usage.filePath.replace(/\\/g, '/'),
                      uriBaseId: '%SRCROOT%',
                    },
                    region: {
                      startLine: usage.line,
                      startColumn: usage.column,
                    },
                  },
                },
              ],
              properties: {
                flagName: usage.flagName,
                methodName: usage.methodName,
                language: usage.language,
                category: usage.category,
              },
            })),
          ),
        versionControlProvenance: [
          {
            repositoryUri: report.metadata.remoteUrl,
            revisionId: report.metadata.commit,
            branch: report.metadata.branch,
          },
        ],
      },
    ],
  };

  const json = JSON.stringify(sarifReport, null, 2);

  if (outputPath) {
    const resolved = path.resolve(outputPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, json, 'utf-8');
    console.log(`[INFO] SARIF report saved to: ${resolved}`);
  }

  return json;
}

/**
 * Extract unique rules for the SARIF report.
 */
function getUniqueRules(report: ScanReport): Array<{
  id: string;
  shortDescription: { text: string };
  defaultConfiguration: { level: string };
}> {
  const ruleMap = new Map<string, { severity: string; description: string }>();

  const descriptions: Record<string, string> = {
    UNDEFINED_FLAG: 'Flag is not defined in the flag definitions file.',
    TYPE_MISMATCH: 'Flag is accessed with the wrong type.',
    ARCHIVED_FLAG_USAGE: 'Flag is archived and should be removed.',
    FALLBACK_TYPE_MISMATCH: 'Fallback value type does not match flag type.',
    UNUSED_FLAG: 'Flag is defined but not referenced in code.',
    POSSIBLE_TYPO: 'Flag name may be a typo.',
    DYNAMIC_FLAG_USAGE: 'Flag name is determined dynamically, cannot be validated statically.',
    STRICT_ACCESS_ON_WRONG_TYPE: 'Strict accessor used on wrong flag type.',
    VARIANT_ACCESS_ON_TYPED_FLAG: 'Generic variant accessor used on a typed flag.',
    WATCH_ON_NON_EXISTENT_FLAG: 'Watch on a flag that does not exist.',
  };

  for (const usage of report.usages) {
    for (const v of usage.validation) {
      if (!ruleMap.has(v.code)) {
        ruleMap.set(v.code, {
          severity: v.severity,
          description: descriptions[v.code] ?? v.message,
        });
      }
    }
  }

  return Array.from(ruleMap.entries()).map(([id, info]) => ({
    id,
    shortDescription: { text: info.description },
    defaultConfiguration: {
      level: info.severity === 'error' ? 'error' : info.severity === 'warning' ? 'warning' : 'note',
    },
  }));
}
