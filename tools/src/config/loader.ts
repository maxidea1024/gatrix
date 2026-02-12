import * as fs from 'fs';
import * as path from 'path';
import {
  ConfigFile,
  FlagDefinitionsFile,
  ScanConfig,
  FunctionPattern,
  LanguageOverrides,
} from '../types';
import {
  DEFAULT_FUNCTION_PATTERNS,
  DEFAULT_SCAN_CONFIG,
  DEFAULT_DEFENSIVE_LIMITS,
} from './defaults';

const CONFIG_FILE_NAME = '.gatrix-flag-code-refs.json';

// ============================================================
// Configuration loader - merges config file with CLI options
// ============================================================

/**
 * Load the config file from the project root.
 */
export function loadConfigFile(root: string): ConfigFile | null {
  const configPath = path.resolve(root, CONFIG_FILE_NAME);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ConfigFile;
  } catch (err) {
    console.error(`[WARN] Failed to parse config file at ${configPath}:`, err);
    return null;
  }
}

/**
 * Load flag definitions from a JSON file.
 */
export function loadFlagDefinitions(filePath: string): FlagDefinitionsFile {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Flag definitions file not found: ${resolved}`);
  }

  try {
    const raw = fs.readFileSync(resolved, 'utf-8');
    const parsed = JSON.parse(raw) as FlagDefinitionsFile;

    if (!parsed.flags || typeof parsed.flags !== 'object') {
      throw new Error('Invalid flag definitions file: missing "flags" object');
    }

    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in flag definitions file: ${resolved}`);
    }
    throw err;
  }
}

/**
 * Merge function patterns: config file patterns extend/override defaults.
 */
function mergeFunctionPatterns(
  defaults: FunctionPattern[],
  custom?: FunctionPattern[],
): FunctionPattern[] {
  if (!custom || custom.length === 0) {
    return [...defaults];
  }

  const merged = new Map<string, FunctionPattern>();

  for (const p of defaults) {
    merged.set(p.namePattern.toLowerCase(), p);
  }

  for (const p of custom) {
    merged.set(p.namePattern.toLowerCase(), p);
  }

  return Array.from(merged.values());
}

/**
 * Merge language overrides.
 */
function mergeLanguageOverrides(
  defaults: LanguageOverrides,
  custom?: LanguageOverrides,
): LanguageOverrides {
  if (!custom) return { ...defaults };

  return {
    lua: {
      sdkModules: custom.lua?.sdkModules ?? defaults.lua?.sdkModules ?? ['gatrix'],
      allowGlobalCalls: custom.lua?.allowGlobalCalls ?? defaults.lua?.allowGlobalCalls ?? false,
    },
  };
}

/**
 * Merge string arrays (deduplicated).
 */
function mergeStringArrays(defaults: string[], custom?: string[]): string[] {
  if (!custom || custom.length === 0) return [...defaults];
  return [...new Set([...defaults, ...custom])];
}

/**
 * Build the final ScanConfig by merging defaults, config file, and CLI options.
 * Priority: CLI options > config file > defaults
 */
export function buildScanConfig(cliOptions: Partial<ScanConfig>): ScanConfig {
  const root = cliOptions.root ?? DEFAULT_SCAN_CONFIG.root;
  const configFile = loadConfigFile(root);

  // Start with defaults
  const config: ScanConfig = { ...DEFAULT_SCAN_CONFIG };

  // Layer config file values
  if (configFile) {
    if (configFile.definitions) config.definitions = configFile.definitions;
    if (configFile.include) config.include = configFile.include;
    if (configFile.exclude) config.exclude = configFile.exclude;
    if (configFile.extensions) config.extensions = configFile.extensions;
    if (configFile.languages) config.languages = configFile.languages;
    if (configFile.root) config.root = configFile.root;
    if (configFile.includeContext !== undefined) config.includeContext = configFile.includeContext;
    if (configFile.contextLines !== undefined) config.contextLines = configFile.contextLines;
    if (configFile.includeBlame !== undefined) config.includeBlame = configFile.includeBlame;
    if (configFile.parallel !== undefined) config.parallel = configFile.parallel;
    if (configFile.cache !== undefined) config.cache = configFile.cache;
    if (configFile.report) config.report = configFile.report;
    if (configFile.ci !== undefined) config.ci = configFile.ci;
    if (configFile.failOnWarning !== undefined) config.failOnWarning = configFile.failOnWarning;
    if (configFile.strictDynamic !== undefined) config.strictDynamic = configFile.strictDynamic;
    if (configFile.reportBackend !== undefined) config.reportBackend = configFile.reportBackend;
    if (configFile.backendUrl) config.backendUrl = configFile.backendUrl;
    if (configFile.apiKey) config.apiKey = configFile.apiKey;
    if (configFile.outputPath) config.outputPath = configFile.outputPath;
    if (configFile.detectionMode) config.detectionMode = configFile.detectionMode;
    if (configFile.sdkPackages)
      config.sdkPackages = mergeStringArrays(config.sdkPackages, configFile.sdkPackages);
    if (configFile.allowedReceivers)
      config.allowedReceivers = mergeStringArrays(
        config.allowedReceivers,
        configFile.allowedReceivers,
      );
    config.languageOverrides = mergeLanguageOverrides(
      config.languageOverrides,
      configFile.languageOverrides,
    );
    if (configFile.extensionMappings) {
      config.extensionMappings = {
        ...config.extensionMappings,
        ...configFile.extensionMappings,
      };
    }
    if (configFile.minFlagKeyLength !== undefined)
      config.minFlagKeyLength = configFile.minFlagKeyLength;
    if (configFile.dryRun !== undefined) config.dryRun = configFile.dryRun;
    if (configFile.delimiters) {
      config.delimiters = { ...config.delimiters, ...configFile.delimiters };
    }
    if (configFile.aliases) {
      config.aliases = {
        types: configFile.aliases.types ?? config.aliases.types,
        literals: { ...config.aliases.literals, ...configFile.aliases.literals },
      };
    }
    if (configFile.limits) {
      config.limits = { ...DEFAULT_DEFENSIVE_LIMITS, ...configFile.limits };
    }
  }

  // Layer CLI options (highest priority)
  const keysToMerge: (keyof ScanConfig)[] = [
    'definitions',
    'include',
    'exclude',
    'extensions',
    'languages',
    'root',
    'includeContext',
    'contextLines',
    'includeBlame',
    'parallel',
    'cache',
    'report',
    'ci',
    'failOnWarning',
    'strictDynamic',
    'reportBackend',
    'backendUrl',
    'apiKey',
    'since',
    'outputPath',
    'detectionMode',
    'allowGlobalLuaDetection',
    'dryRun',
    'minFlagKeyLength',
  ];

  for (const key of keysToMerge) {
    if (cliOptions[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any)[key] = cliOptions[key];
    }
  }

  // Merge function patterns
  config.functionPatterns = mergeFunctionPatterns(
    DEFAULT_FUNCTION_PATTERNS,
    configFile?.functionPatterns ?? cliOptions.functionPatterns,
  );

  // Apply Lua global detection override
  if (config.allowGlobalLuaDetection) {
    config.languageOverrides.lua = {
      ...config.languageOverrides.lua,
      sdkModules: config.languageOverrides.lua?.sdkModules ?? ['gatrix'],
      allowGlobalCalls: true,
    };
  }

  return config;
}
