import {
  LanguageScanner,
  FunctionPattern,
  RawFlagReference,
  SupportedLanguage,
  LanguageTierInfo,
  ScanConfig,
  DetectionStrategy,
} from '../types';
import { buildFunctionNameRegex } from '../utils';

// ============================================================
// Regex-based language scanner (universal fallback)
// With confidence scoring, receiver validation, and comment stripping
// ============================================================

export class RegexScanner implements LanguageScanner {
  readonly language: SupportedLanguage;
  readonly extensions: string[];
  readonly tierInfo: LanguageTierInfo;

  constructor(language: SupportedLanguage, extensions: string[], tierInfo: LanguageTierInfo) {
    this.language = language;
    this.extensions = extensions;
    this.tierInfo = tierInfo;
  }

  scan(
    filePath: string,
    content: string,
    patterns: FunctionPattern[],
    config: ScanConfig,
  ): RawFlagReference[] {
    const references: RawFlagReference[] = [];

    // Build a set of comment line ranges to skip
    const commentRanges = this.detectCommentRanges(content);
    const lines = content.split('\n');

    // Pre-analyze: detect SDK imports/requires
    const importInfo = this.detectImports(content, config);

    for (const pattern of patterns) {
      const funcRegex = buildFunctionNameRegex(pattern.namePattern);

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

        // Skip lines that are entirely within a comment block
        if (this.isLineInComment(lineIdx + 1, commentRanges)) continue;

        // Strip inline comments from the line before matching
        const cleanLine = this.stripInlineComment(line);

        let match: ReturnType<RegExp['exec']>;
        const localRegex = new RegExp(funcRegex.source, 'g');

        while ((match = localRegex.exec(cleanLine)) !== null) {
          const afterMatch = cleanLine.slice(match.index + match[0].length);

          // Check for function call pattern: functionName(
          const callMatch = afterMatch.match(/^\s*\(/);
          if (!callMatch) continue;

          // Skip function DEFINITIONS (not calls)
          // e.g., "function useFlag(", "export function useFlag(",
          //        "async function useFlag(", "def useFlag(", "func useFlag("
          const beforeMatch = cleanLine.slice(0, match.index).trimEnd();
          if (/\b(?:function|def|func|fn|fun|sub)\s*$/.test(beforeMatch)) continue;

          // Extract receiver
          const receiverInfo = this.extractReceiver(cleanLine, match.index);

          // Apply detection mode filtering
          const shouldInclude = this.applyDetectionMode(config, importInfo, receiverInfo.receiver);
          if (!shouldInclude) continue;

          // Extract first argument
          const argStart = match.index + match[0].length + afterMatch.indexOf('(') + 1;
          const flagInfo = this.extractFirstArgument(cleanLine, argStart);

          // Compute confidence score
          const confidence = this.computeConfidence(
            importInfo,
            receiverInfo,
            flagInfo.isDynamic,
            config,
          );

          references.push({
            flagName: flagInfo.value,
            filePath,
            line: lineIdx + 1,
            column: match.index + 1,
            methodName: match[0],
            requestedType: pattern.type,
            category: pattern.category,
            isStrict: pattern.strict,
            codeSnippet: line.trim(), // Keep original line for display
            isDynamic: flagInfo.isDynamic,
            confidenceScore: confidence.score,
            languageTier: this.tierInfo.tier,
            detectionStrategy: confidence.strategy,
          });
        }
      }
    }

    return references;
  }

  // ============================
  // Comment detection & stripping
  // ============================

  /**
   * Detect ranges of multi-line comments in the source content.
   * Returns array of [startLine, endLine] (1-indexed, inclusive).
   */
  protected detectCommentRanges(content: string): CommentRange[] {
    const ranges: CommentRange[] = [];
    const lines = content.split('\n');

    let inBlockComment = false;
    let blockStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (inBlockComment) {
        // Check for block comment end: */ or --]]
        if (line.includes('*/') || line.includes(']]')) {
          ranges.push({ start: blockStart, end: i + 1 });
          inBlockComment = false;
        }
        continue;
      }

      // Check if line is a single-line comment
      const trimmed = line.trimStart();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        (trimmed.startsWith('--') && !trimmed.startsWith('--[['))
      ) {
        ranges.push({ start: i + 1, end: i + 1 });
        continue;
      }

      // Check for block comment start: /* or --[[
      if (trimmed.includes('/*') && !trimmed.includes('*/')) {
        inBlockComment = true;
        blockStart = i + 1;
      } else if (trimmed.includes('/*') && trimmed.includes('*/')) {
        // Single-line block comment /* ... */
        ranges.push({ start: i + 1, end: i + 1 });
      }

      if (trimmed.startsWith('--[[') && !trimmed.includes(']]')) {
        inBlockComment = true;
        blockStart = i + 1;
      }
    }

    return ranges;
  }

  /**
   * Check if a line number is inside a comment range.
   */
  protected isLineInComment(lineNum: number, ranges: CommentRange[]): boolean {
    return ranges.some((r) => lineNum >= r.start && lineNum <= r.end);
  }

  /**
   * Strip inline comments from a line.
   * e.g., "code(); // comment" -> "code(); "
   * Respects string literals to avoid stripping inside strings.
   */
  protected stripInlineComment(line: string): string {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const prev = i > 0 ? line[i - 1] : '';

      if (prev === '\\') continue;

      if (ch === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
      } else if (ch === '"' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
      } else if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
      }

      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        // C-style: //
        if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') {
          return line.slice(0, i);
        }
        // Lua/Haskell: --
        if (ch === '-' && i + 1 < line.length && line[i + 1] === '-') {
          return line.slice(0, i);
        }
        // Python/Shell: #
        if (ch === '#') {
          return line.slice(0, i);
        }
      }
    }

    return line;
  }

  // ============================
  // Import / Receiver detection
  // ============================

  /**
   * Detect SDK imports/requires in the file.
   */
  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result: ImportDetectionResult = {
      hasImport: false,
      importedNames: [],
      receiverVariable: null,
    };

    const allPackages = config.sdkPackages;

    for (const pkg of allPackages) {
      const escapedPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // ES import: import { x } from 'pkg' or import x from 'pkg'
      const esImportRe = new RegExp(
        `import\\s+(?:\\{([^}]+)\\}|([a-zA-Z_$][a-zA-Z0-9_$]*))\\s+from\\s+['"]${escapedPkg}['"]`,
        'g',
      );
      let m: ReturnType<RegExp['exec']>;
      while ((m = esImportRe.exec(content)) !== null) {
        result.hasImport = true;
        if (m[1]) {
          result.importedNames.push(
            ...m[1].split(',').map((s) =>
              s
                .trim()
                .split(/\s+as\s+/)
                .pop()!
                .trim(),
            ),
          );
        }
        if (m[2]) {
          result.importedNames.push(m[2]);
          result.receiverVariable = m[2];
        }
      }

      // CommonJS: const x = require('pkg')
      const requireRe = new RegExp(
        `(?:const|let|var)\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=\\s*require\\s*\\(\\s*['"]${escapedPkg}['"]\\s*\\)`,
        'g',
      );
      while ((m = requireRe.exec(content)) !== null) {
        result.hasImport = true;
        result.importedNames.push(m[1]);
        result.receiverVariable = m[1];
      }

      // C# using
      const usingRe = new RegExp(`using\\s+${escapedPkg}\\s*;`, 'g');
      if (usingRe.test(content)) {
        result.hasImport = true;
      }

      // Java/Kotlin import
      const javaImportRe = new RegExp(`import\\s+${escapedPkg}[.][^;]+;`, 'g');
      if (javaImportRe.test(content)) {
        result.hasImport = true;
      }

      // C/C++ #include
      const includeRe = new RegExp(`#include\\s*[<"]${escapedPkg}[>"]`, 'g');
      if (includeRe.test(content)) {
        result.hasImport = true;
      }
    }

    return result;
  }

  /**
   * Extract the receiver (object) before a method call.
   */
  protected extractReceiver(line: string, methodStart: number): ReceiverInfo {
    const before = line.slice(0, methodStart);

    // Match dot/colon access: receiver.method or receiver:method
    const dotMatch = before.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[.:]\s*$/);
    if (dotMatch) {
      return {
        receiver: dotMatch[1],
        hasReceiver: true,
        isColonCall: before.trimEnd().endsWith(':'),
      };
    }

    // this.method / self.method
    const thisMatch = before.match(/(this|self)\s*[.:]\s*$/);
    if (thisMatch) {
      return { receiver: thisMatch[1], hasReceiver: true, isColonCall: false };
    }

    return { receiver: null, hasReceiver: false, isColonCall: false };
  }

  /**
   * Apply detection mode to decide whether to include a match.
   */
  protected applyDetectionMode(
    config: ScanConfig,
    importInfo: ImportDetectionResult,
    receiver: string | null,
  ): boolean {
    const mode = config.detectionMode;

    switch (mode) {
      case 'strict':
        if (!importInfo.hasImport) return false;
        if (receiver && !this.isAllowedReceiver(receiver, config, importInfo)) return false;
        return true;

      case 'balanced':
        if (importInfo.hasImport) return true;
        if (receiver && this.isAllowedReceiver(receiver, config, importInfo)) return true;
        return false;

      case 'aggressive':
        return true;

      default:
        return true;
    }
  }

  /**
   * Check if a receiver is in the allowed list.
   */
  protected isAllowedReceiver(
    receiver: string,
    config: ScanConfig,
    importInfo: ImportDetectionResult,
  ): boolean {
    const lowerReceiver = receiver.toLowerCase();

    if (config.allowedReceivers.some((r) => r.toLowerCase() === lowerReceiver)) {
      return true;
    }

    if (importInfo.receiverVariable?.toLowerCase() === lowerReceiver) {
      return true;
    }

    return false;
  }

  /**
   * Extract the first argument from a function call.
   */
  protected extractFirstArgument(
    line: string,
    startPos: number,
  ): { value: string; isDynamic: boolean } {
    const remaining = line.slice(startPos).trim();

    const singleQuote = remaining.match(/^'([^'\\]*(?:\\.[^'\\]*)*)'/);
    if (singleQuote) {
      return { value: singleQuote[1], isDynamic: false };
    }

    const doubleQuote = remaining.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (doubleQuote) {
      return { value: doubleQuote[1], isDynamic: false };
    }

    const backtick = remaining.match(/^`([^`$]*)`/);
    if (backtick) {
      return { value: backtick[1], isDynamic: false };
    }

    const verbatim = remaining.match(/^@"([^"]*)"/);
    if (verbatim) {
      return { value: verbatim[1], isDynamic: false };
    }

    const dynamicMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)/);
    const dynamicName = dynamicMatch ? dynamicMatch[1] : '<dynamic>';
    return { value: dynamicName, isDynamic: true };
  }

  /**
   * Compute confidence score based on evidence.
   */
  protected computeConfidence(
    importInfo: ImportDetectionResult,
    receiverInfo: ReceiverInfo,
    isDynamic: boolean,
    config: ScanConfig,
  ): { score: number; strategy: DetectionStrategy } {
    let score = 0;
    const factors: string[] = [];

    // +50 SDK import confirmed
    if (importInfo.hasImport) {
      score += 50;
      factors.push('import');
    }

    // +30 Receiver matches SDK client or allowed list
    if (receiverInfo.hasReceiver) {
      const isAllowed = receiverInfo.receiver
        ? this.isAllowedReceiver(receiverInfo.receiver, config, importInfo)
        : false;
      if (isAllowed) {
        score += 30;
        factors.push('receiver');
      } else {
        score += 10;
      }
    }

    // +20 Function name pattern match (baseline)
    score += 20;

    // +10 Literal string argument
    if (!isDynamic) {
      score += 10;
    }

    // -20 Dynamic flag
    if (isDynamic) {
      score -= 20;
    }

    // -30 No receiver validation for Tier 3
    if (this.tierInfo.tier === 3 && !receiverInfo.hasReceiver) {
      score -= 30;
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine strategy label
    let strategy: DetectionStrategy;
    if (factors.includes('import') && factors.includes('receiver')) {
      strategy = this.tierInfo.supportsTypeTracking ? 'import+type' : 'import+receiver';
    } else if (factors.includes('import')) {
      strategy = 'import';
    } else if (factors.includes('receiver')) {
      strategy = 'receiver';
    } else {
      strategy = 'regex-fallback';
    }

    return { score, strategy };
  }
}

// -- Supporting types --

export interface CommentRange {
  start: number; // 1-indexed line number
  end: number; // 1-indexed line number, inclusive
}

export interface ImportDetectionResult {
  hasImport: boolean;
  importedNames: string[];
  receiverVariable: string | null;
}

export interface ReceiverInfo {
  receiver: string | null;
  hasReceiver: boolean;
  isColonCall: boolean;
}
