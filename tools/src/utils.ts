import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================
// Utility functions
// ============================================================

/**
 * Compute SHA-256 hash of file content for caching.
 */
export function computeFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Read file content safely, returns null on error.
 */
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a file exists.
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, create recursively if not.
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Resolve a path relative to a root directory.
 */
export function resolvePath(root: string, relativePath: string): string {
  return path.resolve(root, relativePath);
}

/**
 * Get the relative path from root.
 */
export function getRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

/**
 * Normalize a file path to use forward slashes.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Map file extension to language identifier.
 */
export function extensionToLanguage(ext: string): string | null {
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.dart': 'dart',
    '.lua': 'lua',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.cxx': 'cpp',
    '.cc': 'cpp',
    '.hpp': 'cpp',
    '.hh': 'cpp',
    '.cs': 'csharp',
    '.java': 'java',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.py': 'python',
    '.go': 'go',
    '.swift': 'swift',
    '.php': 'php',
  };
  return map[ext] ?? null;
}

/**
 * Convert camelCase/PascalCase/snake_case to a consistent form for matching.
 */
export function normalizeMethodName(name: string): string {
  // Convert snake_case to camelCase for comparison
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Check if a method name matches a pattern (supports camelCase, PascalCase, snake_case).
 */
export function matchesMethodPattern(methodName: string, pattern: string): boolean {
  const normalizedMethod = normalizeMethodName(methodName).toLowerCase();
  const normalizedPattern = normalizeMethodName(pattern).toLowerCase();
  return normalizedMethod === normalizedPattern;
}

/**
 * Build a regex that matches a function name in camelCase, PascalCase, and snake_case forms.
 */
export function buildFunctionNameRegex(baseName: string): RegExp {
  // Generate all naming variants
  const variants: string[] = [];

  // Original
  variants.push(baseName);

  // camelCase (already typical)
  variants.push(baseName.charAt(0).toLowerCase() + baseName.slice(1));

  // PascalCase
  variants.push(baseName.charAt(0).toUpperCase() + baseName.slice(1));

  // snake_case
  const snakeCase = baseName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
  variants.push(snakeCase);

  // Deduplicate
  const unique = [...new Set(variants)];

  // Escape for regex safety
  const escaped = unique.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`\\b(?:${escaped.join('|')})`, 'g');
}

/**
 * Format bytes to human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format duration in milliseconds to human-readable.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Extract surrounding context lines from file content.
 */
export function extractContext(content: string, targetLine: number, contextLines: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, targetLine - 1 - contextLines);
  const end = Math.min(lines.length, targetLine + contextLines);
  return lines.slice(start, end).join('\n');
}

/**
 * Chunk an array into batches of specified size.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================
// Binary file detection
// ============================================================

/**
 * Check if content appears to be a binary file.
 * Looks for null bytes in the first 8KB (same heuristic as git/GNU diff).
 */
export function isBinaryContent(content: string): boolean {
  const sampleSize = Math.min(content.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    if (content.charCodeAt(i) === 0) {
      return true;
    }
  }
  return false;
}

// ============================================================
// Line truncation (prevent massive hunks from minified files)
// ============================================================

/**
 * Truncate a line to maxCharCount characters (UTF-8 safe).
 * Appends ellipsis if truncated.
 */
export function truncateLine(line: string, maxCharCount: number): string {
  if ([...line].length <= maxCharCount) {
    return line;
  }
  const runes = [...line];
  return runes.slice(0, maxCharCount).join('') + '...';
}

// ============================================================
// Flag alias generation (naming convention aliases)
// ============================================================

/**
 * Convert a flag key like "my-flag-name" to camelCase: "myFlagName"
 */
export function toCamelCase(flagKey: string): string {
  return flagKey
    .replace(/[-_.]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toLowerCase());
}

/**
 * Convert a flag key to PascalCase: "MyFlagName"
 */
export function toPascalCase(flagKey: string): string {
  const camel = toCamelCase(flagKey);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert a flag key to snake_case: "my_flag_name"
 */
export function toSnakeCase(flagKey: string): string {
  return flagKey
    .replace(/[-. ]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Convert a flag key to UPPER_SNAKE_CASE: "MY_FLAG_NAME"
 */
export function toUpperSnakeCase(flagKey: string): string {
  return toSnakeCase(flagKey).toUpperCase();
}

/**
 * Convert a flag key to kebab-case: "my-flag-name"
 */
export function toKebabCase(flagKey: string): string {
  return flagKey
    .replace(/[_. ]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Convert a flag key to dot.case: "my.flag.name"
 */
export function toDotCase(flagKey: string): string {
  return flagKey
    .replace(/[-_ ]+/g, '.')
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .toLowerCase();
}

import { AliasType } from './types';

/**
 * Generate all aliases for a flag key based on the configured alias types + literals.
 * Deduplicates and excludes the original flag key itself.
 */
export function generateFlagAliases(
  flagKey: string,
  aliasTypes: AliasType[],
  literals?: Record<string, string[]>,
): string[] {
  const aliases = new Set<string>();

  for (const type of aliasTypes) {
    let alias: string;
    switch (type) {
      case 'camelCase':
        alias = toCamelCase(flagKey);
        break;
      case 'pascalCase':
        alias = toPascalCase(flagKey);
        break;
      case 'snakeCase':
        alias = toSnakeCase(flagKey);
        break;
      case 'upperSnakeCase':
        alias = toUpperSnakeCase(flagKey);
        break;
      case 'kebabCase':
        alias = toKebabCase(flagKey);
        break;
      case 'dotCase':
        alias = toDotCase(flagKey);
        break;
    }
    if (alias !== flagKey) {
      aliases.add(alias);
    }
  }

  // Add literal aliases
  if (literals && literals[flagKey]) {
    for (const lit of literals[flagKey]) {
      if (lit !== flagKey) {
        aliases.add(lit);
      }
    }
  }

  return Array.from(aliases);
}

// ============================================================
// .gatrixignore file support
// ============================================================

/**
 * Load patterns from a .gatrixignore file (gitignore-like format).
 * Returns an array of glob patterns. Empty lines and comments (#) are ignored.
 */
export function loadIgnorePatterns(root: string): string[] {
  const ignoreFiles = ['.gatrixignore', '.ignore'];
  const patterns: string[] = [];

  for (const fileName of ignoreFiles) {
    const filePath = path.join(root, fileName);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Convert to glob pattern that fast-glob understands
          if (trimmed.startsWith('/')) {
            patterns.push(trimmed.slice(1));
          } else {
            patterns.push(`**/${trimmed}`);
          }
        }
      }
    } catch {
      // File does not exist, continue
    }
  }

  return patterns;
}

// ============================================================
// Short flag key filter
// ============================================================

/**
 * Filter out flag keys shorter than minLength to reduce false positives.
 * Returns [validKeys, omittedKeys].
 */
export function filterShortFlagKeys(
  flagKeys: string[],
  minLength: number,
): { valid: string[]; omitted: string[] } {
  const valid: string[] = [];
  const omitted: string[] = [];

  for (const key of flagKeys) {
    if (key.length >= minLength) {
      valid.push(key);
    } else {
      omitted.push(key);
    }
  }

  return { valid, omitted };
}
