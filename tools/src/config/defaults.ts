import {
  FunctionPattern,
  ScanConfig,
  DefensiveLimits,
  DelimiterConfig,
  AliasConfig,
} from '../types';

// ============================================================
// Default function patterns for flag access detection
// ============================================================

export const DEFAULT_FUNCTION_PATTERNS: FunctionPattern[] = [
  // Core Access
  { namePattern: 'isEnabled', type: 'bool', strict: false, category: 'core' },
  { namePattern: 'getVariant', type: 'variant', strict: false, category: 'core' },
  { namePattern: 'getFlag', type: 'variant', strict: false, category: 'core' },
  { namePattern: 'watchFlag', type: 'variant', strict: false, category: 'observer' },
  {
    namePattern: 'watchFlagWithInitialState',
    type: 'variant',
    strict: false,
    category: 'observer',
  },

  // Typed Variation
  { namePattern: 'variation', type: 'variant', strict: false, category: 'typed' },
  { namePattern: 'boolVariation', type: 'bool', strict: false, category: 'typed' },
  { namePattern: 'stringVariation', type: 'string', strict: false, category: 'typed' },
  { namePattern: 'numberVariation', type: 'number', strict: false, category: 'typed' },
  { namePattern: 'jsonVariation', type: 'json', strict: false, category: 'typed' },

  // Variation Details
  { namePattern: 'boolVariationDetails', type: 'bool', strict: false, category: 'detail' },
  { namePattern: 'stringVariationDetails', type: 'string', strict: false, category: 'detail' },
  { namePattern: 'numberVariationDetails', type: 'number', strict: false, category: 'detail' },
  { namePattern: 'jsonVariationDetails', type: 'json', strict: false, category: 'detail' },

  // Strict
  { namePattern: 'boolVariationOrThrow', type: 'bool', strict: true, category: 'strict' },
  { namePattern: 'stringVariationOrThrow', type: 'string', strict: true, category: 'strict' },
  { namePattern: 'numberVariationOrThrow', type: 'number', strict: true, category: 'strict' },
  { namePattern: 'jsonVariationOrThrow', type: 'json', strict: true, category: 'strict' },

  // React / Vue Hooks & Composables
  { namePattern: 'useFlag', type: 'bool', strict: false, category: 'core' },
  { namePattern: 'useFlagProxy', type: 'variant', strict: false, category: 'core' },
  { namePattern: 'useVariant', type: 'variant', strict: false, category: 'core' },
  { namePattern: 'useBoolVariation', type: 'bool', strict: false, category: 'typed' },
  { namePattern: 'useStringVariation', type: 'string', strict: false, category: 'typed' },
  { namePattern: 'useNumberVariation', type: 'number', strict: false, category: 'typed' },
  { namePattern: 'useJsonVariation', type: 'json', strict: false, category: 'typed' },

  // Svelte Store Functions
  { namePattern: 'flag', type: 'variant', strict: false, category: 'core' },
  { namePattern: 'flagState', type: 'variant', strict: false, category: 'core' },
  { namePattern: 'variant', type: 'variant', strict: false, category: 'core' },
];

// ============================================================
// Default SDK packages and receivers
// ============================================================

export const DEFAULT_SDK_PACKAGES: string[] = [
  '@gatrix/sdk',
  '@gatrix/client',
  '@gatrix/react',
  '@gatrix/vue',
  '@gatrix/svelte',
  '@gatrix/js-client-sdk',
  'gatrix-sdk',
  'gatrix-js-client-sdk',
  'gatrix-react-sdk',
  'gatrix-vue-sdk',
  'gatrix-svelte-sdk',
  'com.gatrix.sdk',
  'Gatrix.Feature',
];

export const DEFAULT_ALLOWED_RECEIVERS: string[] = [
  'gatrix',
  'flagClient',
  'featureClient',
  'features',
  'client',
  'sdk',
  'flags',
];

// ============================================================
// Defensive limits (prevent resource explosion on large repos)
// ============================================================

export const DEFAULT_DEFENSIVE_LIMITS: DefensiveLimits = {
  maxFileCount: 25000,
  maxReferenceCount: 25000,
  maxLineCharCount: 500,
};

// ============================================================
// Default delimiters for flag key matching
// ============================================================

export const DEFAULT_DELIMITER_CONFIG: DelimiterConfig = {
  disableDefaults: false,
  additional: [],
};

// ============================================================
// Default flag alias configuration
// ============================================================

export const DEFAULT_ALIAS_CONFIG: AliasConfig = {
  types: ['camelCase', 'pascalCase', 'snakeCase', 'upperSnakeCase'],
  literals: {},
};

// ============================================================
// Default scan configuration
// ============================================================

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  definitions: '',
  include: ['**/*'],
  exclude: [
    'node_modules/**',
    '**/node_modules/**',
    'dist/**',
    '**/dist/**',
    'build/**',
    '**/build/**',
    '**/.git/**',
    '.git/**',
    '**/vendor/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/*.d.ts',
    '**/.gatrix-reference-codes/**',
  ],
  extensions: [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.dart',
    '.lua',
    '.c',
    '.h',
    '.cpp',
    '.cxx',
    '.cc',
    '.hpp',
    '.hh',
    '.cs',
    '.java',
    '.kt',
    '.kts',
    '.rs',
    '.rb',
    '.py',
    '.go',
    '.swift',
    '.php',
    '.gd',
  ],
  languages: [],
  root: '.',
  includeContext: false,
  contextLines: 3,
  includeBlame: false,
  parallel: 4,
  cache: false,
  report: ['console'],
  ci: false,
  failOnWarning: false,
  strictDynamic: false,
  reportBackend: false,
  functionPatterns: DEFAULT_FUNCTION_PATTERNS,

  // SDK & detection
  sdkPackages: DEFAULT_SDK_PACKAGES,
  allowedReceivers: DEFAULT_ALLOWED_RECEIVERS,
  detectionMode: 'balanced',
  languageOverrides: {
    lua: {
      sdkModules: ['gatrix'],
      allowGlobalCalls: false,
    },
  },
  allowGlobalLuaDetection: false,

  // Default extension-to-language mappings for uncommon extensions
  extensionMappings: {},

  // Flag key filtering
  minFlagKeyLength: 3,

  // Dry run mode
  dryRun: false,

  // Delimiter config
  delimiters: DEFAULT_DELIMITER_CONFIG,

  // Alias config
  aliases: DEFAULT_ALIAS_CONFIG,

  // Defensive limits
  limits: DEFAULT_DEFENSIVE_LIMITS,
};
