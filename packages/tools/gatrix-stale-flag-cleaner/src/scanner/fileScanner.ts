import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================================
// Pre-scan: find files that actually reference the flag key
// before handing the task to the AI agent.
// This keeps the agent focused only on relevant files and avoids
// unnecessary scanning of unrelated parts of the codebase.
// ============================================================

/**
 * Build all naming-convention variants of the flag key.
 * The same logic as in the prompt, so the search covers every possible form.
 */
export function buildFlagVariants(key: string): string[] {
  const tokens = key.split(/[-_.]+/).filter((t) => t.length > 0);

  const variants = new Set<string>();
  variants.add(key);

  if (tokens.length > 1) {
    // camelCase
    variants.add(
      tokens[0].toLowerCase() +
        tokens
          .slice(1)
          .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
          .join(''),
    );
    // PascalCase
    variants.add(tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(''));
    // snake_case
    variants.add(tokens.map((t) => t.toLowerCase()).join('_'));
    // SCREAMING_SNAKE
    variants.add(tokens.map((t) => t.toUpperCase()).join('_'));
    // kebab (normalised)
    variants.add(tokens.map((t) => t.toLowerCase()).join('-'));
  }

  return [...variants];
}

/**
 * Find all files in `repoPath` that contain at least one variant of the flag key.
 * Uses ripgrep (rg) when available for speed; falls back to a Node.js recursive scan.
 *
 * Returns relative paths from `repoPath`.
 */
export function findFilesWithFlag(flagKey: string, repoPath: string): string[] {
  const variants = buildFlagVariants(flagKey);

  try {
    return findWithRipgrep(variants, repoPath);
  } catch {
    // ripgrep not available — fall back to manual scan
    return findWithNodeScan(variants, repoPath);
  }
}

// ============================================================
// ripgrep-based fast search
// ============================================================

function findWithRipgrep(variants: string[], repoPath: string): string[] {
  const pattern = variants.map(escapeRegex).join('|');
  const output = execSync(`rg -l --fixed-strings -e "${variants.join('" -e "')}"`, {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  void pattern; // pattern is unused when using -e flags
  return output
    .trim()
    .split('\n')
    .filter((f) => f.length > 0);
}

// ============================================================
// Node.js fallback scan
// ============================================================

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  '.dart_tool',
  'obj',
  'bin',
  'Packages',
  'Library',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.cs',
  '.cpp',
  '.cc',
  '.c',
  '.h',
  '.hpp',
  '.dart',
  '.lua',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.php',
  '.gdscript',
  '.yaml',
  '.yml',
  '.json',
  '.md',
]);

function findWithNodeScan(variants: string[], repoPath: string): string[] {
  const results: string[] = [];
  scanDir(repoPath, repoPath, variants, results);
  return results;
}

function scanDir(baseDir: string, currentDir: string, variants: string[], results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      scanDir(baseDir, fullPath, variants, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;

      let content: string;
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch {
        continue;
      }

      if (variants.some((v) => content.includes(v))) {
        results.push(path.relative(baseDir, fullPath));
      }
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
