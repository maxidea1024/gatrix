import {
  LanguageScanner,
  FunctionPattern,
  RawFlagReference,
  LanguageTierInfo,
  ScanConfig,
} from '../types';
import { RegexScanner, ImportDetectionResult } from './regexScanner';

// ============================================================
// TypeScript/JavaScript scanner (Tier 1)
// High confidence: Import + Type tracking
// ============================================================

const TS_TIER_INFO: LanguageTierInfo = {
  tier: 1,
  supportsImportTracking: true,
  supportsTypeTracking: true,
};

export class TypeScriptScanner extends RegexScanner implements LanguageScanner {
  constructor() {
    super('typescript', ['.ts', '.tsx'], TS_TIER_INFO);
  }

  scan(
    filePath: string,
    content: string,
    patterns: FunctionPattern[],
    config: ScanConfig,
    globalAliases?: Map<string, string>,
  ): RawFlagReference[] {
    // Resolve aliases (local + global) before scanning
    const resolvedContent = this.resolveAliases(content, globalAliases);
    return super.scan(filePath, resolvedContent, patterns, config);
  }

  /**
   * Resolve aliases that map to string literals.
   * Now also handles object properties: const FLAG_NAMES = { KEY: 'value' };
   */
  private resolveAliases(content: string, globalAliases?: Map<string, string>): string {
    const localAliases = this.collectAliases(content);
    const combinedAliases = new Map([...(globalAliases || []), ...localAliases]);

    if (combinedAliases.size === 0) return content;

    let resolved = content;
    // Sort aliases by length (descending) to avoid partial replacement of long aliases
    const sortedKeys = Array.from(combinedAliases.keys()).sort((a, b) => b.length - a.length);

    for (const alias of sortedKeys) {
      // Optimization: skip regex if alias not present in content
      if (!content.includes(alias)) continue;

      const value = combinedAliases.get(alias)!;
      // Escape dots for regex
      const escapedAlias = alias.replace(/\./g, '\\.');
      // Match alias as a whole word, optionally inside parentheses for function calls
      const aliasRegex = new RegExp(`(\\()\\s*${escapedAlias}\\s*([,)])`, 'g');
      resolved = resolved.replace(aliasRegex, `$1'${value}'$2`);
    }

    return resolved;
  }

  /**
   * Collect aliases from file content.
   */
  public collectAliases(content: string): Map<string, string> {
    const aliasMap = new Map<string, string>();

    // Pattern 1: Simple string constants
    // const FLAG_KEY = 'my_flag';
    const constPattern =
      /(?:export\s+)?(?:const|let|var|final|static\s+final)\s+([A-Z_][A-Z0-9_]*)\s*(?::\s*string)?\s*=\s*['"]([^'"]+)['"]/g;
    let match: ReturnType<RegExp['exec']>;

    while ((match = constPattern.exec(content)) !== null) {
      aliasMap.set(match[1], match[2]);
    }

    // Pattern 2: Object literals with string values
    // const FLAG_NAMES = { KEY: 'value', ... };
    const objectPattern =
      /(?:export\s+)?(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=\s*\{([\s\S]+?)\}\s*(?:as\s+const)?\s*;/g;
    while ((match = objectPattern.exec(content)) !== null) {
      const objName = match[1];
      const objBody = match[2];
      const propPattern = /([A-Z_][A-Z0-9_]*)\s*:\s*['"]([^'"]+)['"]/g;
      let propMatch: ReturnType<RegExp['exec']>;
      while ((propMatch = propPattern.exec(objBody)) !== null) {
        aliasMap.set(`${objName}.${propMatch[1]}`, propMatch[2]);
      }
    }

    return aliasMap;
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // TS/JS specific: also detect destructured imports
    // import { useFlag } from '@gatrix/react'
    for (const pkg of config.sdkPackages) {
      const escapedPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const destructuredRe = new RegExp(
        `import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${escapedPkg}(?:/[^'"]*)?['"]`,
        'g',
      );
      let m: ReturnType<RegExp['exec']>;
      while ((m = destructuredRe.exec(content)) !== null) {
        result.hasImport = true;
        const names = m[1].split(',').map((s) => {
          const parts = s.trim().split(/\s+as\s+/);
          return parts[parts.length - 1].trim();
        });
        result.importedNames.push(...names);
      }
    }

    return result;
  }
}

/**
 * JavaScript scanner (Tier 1, reuses TypeScript logic).
 */
export class JavaScriptScanner extends RegexScanner implements LanguageScanner {
  private tsScanner: TypeScriptScanner;

  constructor() {
    super('javascript', ['.js', '.jsx'], TS_TIER_INFO);
    this.tsScanner = new TypeScriptScanner();
  }

  scan(
    filePath: string,
    content: string,
    patterns: FunctionPattern[],
    config: ScanConfig,
    globalAliases?: Map<string, string>,
  ): RawFlagReference[] {
    return this.tsScanner.scan(filePath, content, patterns, config, globalAliases);
  }

  public collectAliases(content: string): Map<string, string> {
    return this.tsScanner.collectAliases(content);
  }
}
