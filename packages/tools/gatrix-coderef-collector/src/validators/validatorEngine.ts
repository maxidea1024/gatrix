import {
  FlagDefinitionsFile,
  FlagUsage,
  RawFlagReference,
  ScanConfig,
  ValidationIssue,
  SupportedLanguage,
} from '../types';

// ============================================================
// Validation Engine
// Validates flag references against server-provided definitions
// ============================================================

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find possible typo matches for a flag name.
 */
function findPossibleTypos(flagName: string, knownFlags: string[]): string[] {
  return knownFlags.filter((known) => {
    const distance = levenshteinDistance(flagName.toLowerCase(), known.toLowerCase());
    return distance > 0 && distance <= 2;
  });
}

/**
 * Validate a single flag reference against definitions.
 */
export function validateReference(
  ref: RawFlagReference,
  definitions: FlagDefinitionsFile,
  config: ScanConfig,
  language: SupportedLanguage,
): FlagUsage {
  const issues: ValidationIssue[] = [];
  const flagDef = definitions.flags[ref.flagName];
  const knownFlags = Object.keys(definitions.flags);

  // 1. DYNAMIC_FLAG_USAGE
  if (ref.isDynamic) {
    const severity = config.strictDynamic ? 'error' : 'warning';
    issues.push({
      code: 'DYNAMIC_FLAG_USAGE',
      severity,
      message: `Dynamic flag reference detected: ${ref.flagName}. Cannot statically validate.`,
      suggestion: 'Use a string literal or const alias for the flag name.',
    });

    return buildUsage(ref, issues, language, '');
  }

  // 2. UNDEFINED_FLAG
  if (!flagDef) {
    issues.push({
      code: 'UNDEFINED_FLAG',
      severity: 'error',
      message: `Flag "${ref.flagName}" is not defined in the flag definitions.`,
    });

    // 6. POSSIBLE_TYPO
    const typos = findPossibleTypos(ref.flagName, knownFlags);
    if (typos.length > 0) {
      issues.push({
        code: 'POSSIBLE_TYPO',
        severity: 'warning',
        message: `Possible typo for "${ref.flagName}". Did you mean: ${typos.join(', ')}?`,
        suggestion: `Consider using: ${typos[0]}`,
      });
    }

    // 10. WATCH_ON_NON_EXISTENT_FLAG
    if (ref.category === 'observer') {
      issues.push({
        code: 'WATCH_ON_NON_EXISTENT_FLAG',
        severity: 'error',
        message: `Watch on non-existent flag "${ref.flagName}".`,
      });
    }

    return buildUsage(ref, issues, language, '');
  }

  // 3. ARCHIVED_FLAG_USAGE
  if (flagDef.archived) {
    issues.push({
      code: 'ARCHIVED_FLAG_USAGE',
      severity: 'warning',
      message: `Flag "${ref.flagName}" is archived. Consider removing this reference.`,
      suggestion: 'Remove the flag reference and related code.',
    });
  }

  // 4. TYPE_MISMATCH
  if (ref.requestedType !== 'variant' && flagDef.type !== 'variant') {
    if (ref.requestedType !== flagDef.type) {
      issues.push({
        code: 'TYPE_MISMATCH',
        severity: 'error',
        message: `Type mismatch: "${ref.flagName}" is defined as "${flagDef.type}" but accessed as "${ref.requestedType}" via ${ref.methodName}.`,
        suggestion: `Use the ${flagDef.type} variant accessor instead.`,
      });
    }
  }

  // 8. STRICT_ACCESS_ON_WRONG_TYPE
  if (ref.isStrict && ref.requestedType !== 'variant' && ref.requestedType !== flagDef.type) {
    issues.push({
      code: 'STRICT_ACCESS_ON_WRONG_TYPE',
      severity: 'error',
      message: `Strict access via "${ref.methodName}" on "${ref.flagName}" (type: ${flagDef.type}) will throw at runtime.`,
    });
  }

  // 9. VARIANT_ACCESS_ON_TYPED_FLAG
  if (ref.requestedType === 'variant' && flagDef.type !== 'variant') {
    issues.push({
      code: 'VARIANT_ACCESS_ON_TYPED_FLAG',
      severity: 'warning',
      message: `Generic variant access on typed flag "${ref.flagName}" (type: ${flagDef.type}). Consider using type-specific accessor.`,
      suggestion: `Use ${flagDef.type}Variation() instead.`,
    });
  }

  return buildUsage(ref, issues, language, '');
}

/**
 * Detect unused flags (defined but not referenced in any scan).
 */
export function detectUnusedFlags(definitions: FlagDefinitionsFile, usages: FlagUsage[]): string[] {
  const usedFlags = new Set(usages.filter((u) => !u.isDynamic).map((u) => u.flagName));

  return Object.keys(definitions.flags).filter((flag) => !usedFlags.has(flag));
}

/**
 * Build a FlagUsage from a raw reference and validation issues.
 */
function buildUsage(
  ref: RawFlagReference,
  issues: ValidationIssue[],
  language: SupportedLanguage,
  codeUrl: string,
): FlagUsage {
  return {
    flagName: ref.flagName,
    filePath: ref.filePath,
    line: ref.line,
    column: ref.column,
    language,
    methodName: ref.methodName,
    requestedType: ref.requestedType,
    category: ref.category,
    isStrict: ref.isStrict,
    validation: issues,
    confidenceScore: ref.confidenceScore,
    languageTier: ref.languageTier,
    detectionStrategy: ref.detectionStrategy,
    codeSnippet: ref.codeSnippet,
    codeUrl,
    isDynamic: ref.isDynamic,
  };
}
