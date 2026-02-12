import * as path from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import pLimit from 'p-limit';
import {
  ScanConfig,
  FlagDefinitionsFile,
  FlagUsage,
  RawFlagReference,
  ScanReport,
  SupportedLanguage,
} from '../types';
import { ScannerRegistry } from '../scanners';
import { validateReference, detectUnusedFlags } from '../validators';
import { getGitMetadata, getChangedFiles, generateCodeUrl } from '../git';
import { ScanCache } from '../cache';
import {
  getRelativePath,
  readFileSafe,
  extractContext,
  extensionToLanguage,
  isBinaryContent,
  truncateLine,
  loadIgnorePatterns,
  filterShortFlagKeys,
  generateFlagAliases,
} from '../utils';

// ============================================================
// Core Scanner Engine
// Orchestrates file discovery, scanning, validation, and output
// ============================================================

const TOOL_VERSION = '1.0.0';

export interface ScanEngineOptions {
  config: ScanConfig;
  definitions: FlagDefinitionsFile;
}

export class ScannerEngine {
  private config: ScanConfig;
  private definitions: FlagDefinitionsFile;
  private registry: ScannerRegistry;
  private cache: ScanCache | null;
  private truncatedFileCount = 0;
  private omittedShortKeys: string[] = [];
  private globalAliases = new Map<string, string>();

  constructor(options: ScanEngineOptions) {
    this.config = options.config;
    this.definitions = options.definitions;
    this.registry = new ScannerRegistry();
    this.cache = options.config.cache ? new ScanCache(options.config.root) : null;

    // Apply custom extension-to-language mappings from config
    if (Object.keys(options.config.extensionMappings).length > 0) {
      this.registry.applyExtensionMappings(options.config.extensionMappings);
    }

    // Filter short flag keys from definitions
    this.applyShortFlagKeyFilter();
  }

  /**
   * Execute the full scan pipeline.
   */
  async execute(): Promise<ScanReport> {
    const startTime = Date.now();
    const root = path.resolve(this.config.root);
    const { limits } = this.config;

    // Step 1: Discover files (with .gatrixignore support)
    let files = await this.discoverFiles(root);

    // Apply defensive file count limit
    if (files.length > limits.maxFileCount) {
      console.log(
        `[WARN] File count (${files.length}) exceeds limit (${limits.maxFileCount}). Truncating.`,
      );
      files = files.slice(0, limits.maxFileCount);
    }
    console.log(`[INFO] Discovered ${files.length} files to scan.`);

    // Step 2: Collect aliases globally (first pass)
    await this.collectAllAliases(root, files);
    if (this.globalAliases.size > 0) {
      console.log(`[INFO] Collected ${this.globalAliases.size} global aliases.`);
    }

    // Step 3: Scan files in parallel (with binary detection + line truncation) (second pass)
    let allReferences = await this.scanFiles(root, files);
    console.log(`[INFO] Found ${allReferences.length} flag references.`);

    // Apply defensive reference count limit
    if (allReferences.length > limits.maxReferenceCount) {
      console.log(
        `[WARN] Reference count (${allReferences.length}) exceeds limit (${limits.maxReferenceCount}). Truncating.`,
      );
      allReferences = allReferences.slice(0, limits.maxReferenceCount);
    }

    if (this.truncatedFileCount > 0) {
      console.log(
        `[INFO] ${this.truncatedFileCount} files had lines truncated (>${limits.maxLineCharCount} chars).`,
      );
    }

    // Step 3: Apply confidence threshold filtering
    const filteredRefs = this.applyConfidenceFilter(allReferences);
    if (filteredRefs.length !== allReferences.length) {
      console.log(
        `[INFO] ${allReferences.length - filteredRefs.length} low-confidence references filtered.`,
      );
    }

    // Step 4: Get git metadata (async via simple-git)
    const gitMeta = await getGitMetadata(root);

    // Step 5: Validate references and generate code URLs
    const usages = this.validateAndEnrich(
      root,
      filteredRefs,
      gitMeta.remoteUrl,
      gitMeta.commit,
      gitMeta.gitRoot,
    );

    // Step 6: Detect unused flags
    const unusedFlags = detectUnusedFlags(this.definitions, usages);

    // Step 7: Save cache
    if (this.cache) {
      this.cache.save();
    }

    // Log short key filter results
    if (this.omittedShortKeys.length > 0) {
      console.log(
        `[WARN] Omitted ${this.omittedShortKeys.length} flag key(s) shorter than ${this.config.minFlagKeyLength} chars: ${this.omittedShortKeys.join(', ')}`,
      );
    }

    // Step 8: Build report
    const errorCount = usages.reduce(
      (count, u) => count + u.validation.filter((v) => v.severity === 'error').length,
      0,
    );
    const warningCount = usages.reduce(
      (count, u) => count + u.validation.filter((v) => v.severity === 'warning').length,
      0,
    );

    const report: ScanReport = {
      metadata: {
        repository: gitMeta.repository,
        branch: gitMeta.branch,
        commit: gitMeta.commit,
        remoteUrl: gitMeta.remoteUrl,
        scanTime: new Date().toISOString(),
        toolVersion: TOOL_VERSION,
      },
      usages,
      summary: {
        totalFilesScanned: files.length,
        totalUsages: usages.length,
        errors: errorCount,
        warnings: warningCount,
        unusedFlags,
        omittedShortFlagKeys: this.omittedShortKeys,
        truncatedFiles: this.truncatedFileCount,
      },
    };

    const elapsed = Date.now() - startTime;
    console.log(`[INFO] Scan completed in ${elapsed}ms.`);

    return report;
  }

  /**
   * Filter short flag keys from definitions to reduce false positives.
   */
  private applyShortFlagKeyFilter(): void {
    const flagKeys = Object.keys(this.definitions.flags);
    if (flagKeys.length === 0) return;

    const { valid, omitted } = filterShortFlagKeys(flagKeys, this.config.minFlagKeyLength);
    this.omittedShortKeys = omitted;

    if (omitted.length > 0) {
      // Remove short keys from definitions
      const filtered: typeof this.definitions.flags = {};
      for (const key of valid) {
        filtered[key] = this.definitions.flags[key];
      }
      this.definitions = { ...this.definitions, flags: filtered };
    }
  }

  /**
   * Discover files to scan based on configuration.
   * Merges .gatrixignore / .ignore patterns into exclude list.
   */
  private async discoverFiles(root: string): Promise<string[]> {
    // Load .gatrixignore patterns and merge with exclude list
    const ignorePatterns = loadIgnorePatterns(root);
    const excludePatterns = [...this.config.exclude, ...ignorePatterns];

    if (this.config.since) {
      // Incremental scan via simple-git (async)
      const changedFiles = await getChangedFiles(root, this.config.since);
      console.log(
        `[INFO] Incremental scan: ${changedFiles.length} files changed since ${this.config.since}`,
      );

      return changedFiles.filter((f) => {
        const ext = path.extname(f);
        return this.config.extensions.includes(ext);
      });
    }

    const stat = fs.statSync(root);
    if (stat.isFile()) {
      return [root];
    }

    const patterns = this.config.include
      .map((p) => {
        if (!p.includes('.')) {
          return this.config.extensions.map((ext) => p.replace(/\*$/, `*${ext}`));
        }
        return [p];
      })
      .flat();

    const files = await fg(patterns, {
      cwd: root,
      absolute: false,
      ignore: excludePatterns,
      dot: false,
      onlyFiles: true,
    });

    return files.filter((f) => {
      const ext = path.extname(f);
      if (!this.config.extensions.includes(ext)) return false;

      if (this.config.languages.length > 0) {
        const lang = extensionToLanguage(ext);
        if (!lang || !this.config.languages.includes(lang)) return false;
      }

      return true;
    });
  }

  /**
   * Scan all files using parallel processing.
   */
  private async scanFiles(root: string, files: string[]): Promise<RawFlagReference[]> {
    const limit = pLimit(this.config.parallel);
    const allRefs: RawFlagReference[] = [];
    const total = files.length;
    let completed = 0;

    const tasks = files.map((file) =>
      limit(() => {
        const refs = this.scanSingleFile(root, file);
        completed++;
        if (completed % 500 === 0 || completed === total) {
          const pct = Math.round((completed / total) * 100);
          process.stderr.write(`\r[INFO] Scanning files... ${completed}/${total} (${pct}%)`);
        }
        return refs;
      }),
    );

    const results = await Promise.all(tasks);
    if (total > 0) process.stderr.write('\n');
    for (const refs of results) {
      allRefs.push(...refs);
    }
    return allRefs;
  }

  /**
   * Collect all aliases from files in parallel.
   */
  private async collectAllAliases(root: string, files: string[]): Promise<void> {
    const limit = pLimit(this.config.parallel);
    const total = files.length;
    let completed = 0;

    const tasks = files.map((file) =>
      limit(() => {
        this.collectAliasesFromFile(root, file);
        completed++;
        if (completed % 200 === 0 || completed === total) {
          const pct = Math.round((completed / total) * 100);
          process.stderr.write(`\r[INFO] Collecting aliases... ${completed}/${total} (${pct}%)`);
        }
      }),
    );
    await Promise.all(tasks);
    if (total > 0) process.stderr.write('\n');
  }

  /**
   * Collect aliases from a single file.
   */
  private collectAliasesFromFile(root: string, relativePath: string): void {
    const absolutePath = path.resolve(root, relativePath);
    const content = readFileSafe(absolutePath);
    if (!content || isBinaryContent(content)) return;

    const ext = path.extname(relativePath);
    const scanner = this.registry.getByExtension(ext);
    if (!scanner || !scanner.collectAliases) return;

    const fileAliases = scanner.collectAliases(content);
    for (const [alias, value] of fileAliases) {
      this.globalAliases.set(alias, value);
    }
  }

  /**
   * Scan a single file, using cache if available.
   * Skips binary files and applies line truncation.
   */
  private scanSingleFile(root: string, relativePath: string): RawFlagReference[] {
    const absolutePath = path.resolve(root, relativePath);
    const content = readFileSafe(absolutePath);
    if (!content) return [];

    // Skip binary files
    if (isBinaryContent(content)) return [];

    const ext = path.extname(relativePath);
    const scanner = this.registry.getByExtension(ext);
    if (!scanner) return [];

    // Check cache
    if (this.cache && !this.cache.hasChanged(relativePath, content)) {
      const cached = this.cache.getCached(relativePath);
      if (cached) return cached;
    }

    // Apply line truncation for minified/very long lines
    const { maxLineCharCount } = this.config.limits;
    let processedContent = content;
    const lines = content.split('\n');
    let hasTruncation = false;
    for (let i = 0; i < lines.length; i++) {
      const truncated = truncateLine(lines[i], maxLineCharCount);
      if (truncated !== lines[i]) {
        lines[i] = truncated;
        hasTruncation = true;
      }
    }
    if (hasTruncation) {
      processedContent = lines.join('\n');
      this.truncatedFileCount++;
    }

    // Scan the file with config
    const refs = scanner.scan(
      relativePath,
      processedContent,
      this.config.functionPatterns,
      this.config,
      this.globalAliases,
    );

    // Enrich with context if configured
    if (this.config.includeContext) {
      for (const ref of refs) {
        ref.codeSnippet = extractContext(content, ref.line, this.config.contextLines);
      }
    }

    // Update cache
    if (this.cache) {
      this.cache.update(relativePath, content, refs);
    }

    return refs;
  }

  /**
   * Apply confidence-based filtering.
   */
  private applyConfidenceFilter(references: RawFlagReference[]): RawFlagReference[] {
    return references.filter((ref) => {
      // Tier 3: minimum confidence threshold of 30
      if (ref.languageTier === 3 && ref.confidenceScore < 30) {
        return false;
      }
      return true;
    });
  }

  /**
   * Validate all references and enrich with code URLs.
   * File paths for URLs are computed relative to the git repository root.
   * Also matches flag alias references back to canonical flag names.
   */
  private validateAndEnrich(
    root: string,
    references: RawFlagReference[],
    remoteUrl: string,
    commit: string,
    gitRoot: string,
  ): FlagUsage[] {
    // Use git root for URL paths if available, otherwise fall back to scan root
    const urlRoot = gitRoot || root;

    // Build alias map: alias -> canonicalFlagKey
    const aliasMap = this.buildAliasMap();

    return references.map((ref) => {
      const ext = path.extname(ref.filePath);
      const language = (extensionToLanguage(ext) ?? 'typescript') as SupportedLanguage;

      // Resolve alias to canonical flag name if applicable
      if (aliasMap.has(ref.flagName)) {
        ref.flagName = aliasMap.get(ref.flagName)!;
      }

      const usage = validateReference(ref, this.definitions, this.config, language);

      // Generate code URL relative to git repository root
      const absoluteFilePath = path.resolve(root, ref.filePath);
      const relativePath = getRelativePath(urlRoot, absoluteFilePath);
      usage.codeUrl = generateCodeUrl(remoteUrl, commit, relativePath, ref.line);

      return usage;
    });
  }

  /**
   * Build a map from flag aliases to their canonical flag key.
   */
  private buildAliasMap(): Map<string, string> {
    const map = new Map<string, string>();
    const flagKeys = Object.keys(this.definitions.flags);

    for (const flagKey of flagKeys) {
      const aliases = generateFlagAliases(
        flagKey,
        this.config.aliases.types,
        this.config.aliases.literals,
      );
      for (const alias of aliases) {
        // Only map if not already a flag key itself
        if (!this.definitions.flags[alias]) {
          map.set(alias, flagKey);
        }
      }
    }

    return map;
  }
}
