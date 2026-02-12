// ============================================================
// Core type definitions for gatrix-flag-code-refs
// ============================================================

// -- Language Tier Strategy --

export type LanguageTier = 1 | 2 | 3;

export interface LanguageTierInfo {
    tier: LanguageTier;
    supportsImportTracking: boolean;
    supportsTypeTracking: boolean;
}

// -- Detection Mode --

export type DetectionMode = 'strict' | 'balanced' | 'aggressive';

// -- Flag Definitions --

export interface FlagDefinition {
    type: 'bool' | 'string' | 'number' | 'json' | 'variant';
    archived: boolean;
}

export interface FlagDefinitionsFile {
    flags: Record<string, FlagDefinition>;
}

// -- Validation --

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCode =
    | 'UNDEFINED_FLAG'
    | 'TYPE_MISMATCH'
    | 'ARCHIVED_FLAG_USAGE'
    | 'FALLBACK_TYPE_MISMATCH'
    | 'UNUSED_FLAG'
    | 'POSSIBLE_TYPO'
    | 'DYNAMIC_FLAG_USAGE'
    | 'STRICT_ACCESS_ON_WRONG_TYPE'
    | 'VARIANT_ACCESS_ON_TYPED_FLAG'
    | 'WATCH_ON_NON_EXISTENT_FLAG';

export interface ValidationIssue {
    code: ValidationCode;
    severity: ValidationSeverity;
    message: string;
    suggestion?: string;
}

// -- Function Pattern --

export type FunctionCategory = 'core' | 'typed' | 'strict' | 'observer' | 'detail';

export interface FunctionPattern {
    namePattern: string;
    type: string;
    strict: boolean;
    category: FunctionCategory;
}

// -- Flag Alias --

export type AliasType =
    | 'camelCase'
    | 'pascalCase'
    | 'snakeCase'
    | 'upperSnakeCase'
    | 'kebabCase'
    | 'dotCase';

export interface AliasConfig {
    /** Naming convention aliases to generate automatically */
    types: AliasType[];
    /** Explicit literal aliases: { flagKey: ["alias1", "alias2"] } */
    literals?: Record<string, string[]>;
}

// -- Delimiters --

export interface DelimiterConfig {
    /** If true, default delimiters (' " `) are disabled */
    disableDefaults: boolean;
    /** Additional delimiter characters */
    additional: string[];
}

// -- Defensive Limits --

export interface DefensiveLimits {
    /** Maximum number of files containing code references */
    maxFileCount: number;
    /** Maximum number of total code references */
    maxReferenceCount: number;
    /** Maximum number of characters per line (lines exceeding this are truncated) */
    maxLineCharCount: number;
}

// -- Language Override --

export interface LuaLanguageOverride {
    sdkModules: string[];
    allowGlobalCalls: boolean;
}

export interface LanguageOverrides {
    lua?: LuaLanguageOverride;
}

// -- Scan Configuration --

export interface ScanConfig {
    definitions: string;
    include: string[];
    exclude: string[];
    extensions: string[];
    languages: string[];
    root: string;
    since?: string;
    includeContext: boolean;
    contextLines: number;
    includeBlame: boolean;
    parallel: number;
    cache: boolean;
    report: ReportFormat[];
    ci: boolean;
    failOnWarning: boolean;
    strictDynamic: boolean;
    reportBackend: boolean;
    backendUrl?: string;
    apiKey?: string;
    functionPatterns: FunctionPattern[];
    outputPath?: string;
    dryRun: boolean;

    // SDK & detection
    sdkPackages: string[];
    allowedReceivers: string[];
    detectionMode: DetectionMode;
    languageOverrides: LanguageOverrides;
    allowGlobalLuaDetection: boolean;

    // Custom extension-to-language mapping (e.g., { '.hh': 'cpp', '.mm': 'cpp' })
    extensionMappings: Record<string, SupportedLanguage>;

    // Flag key filtering
    minFlagKeyLength: number;

    // Delimiter-based matching
    delimiters: DelimiterConfig;

    // Flag aliases (naming convention aliases)
    aliases: AliasConfig;

    // Defensive limits to prevent excessive resource usage
    limits: DefensiveLimits;
}

export type ReportFormat = 'console' | 'json' | 'html' | 'sarif';

// -- Config File --

export interface ConfigFile {
    definitions?: string;
    include?: string[];
    exclude?: string[];
    extensions?: string[];
    languages?: string[];
    root?: string;
    includeContext?: boolean;
    contextLines?: number;
    includeBlame?: boolean;
    parallel?: number;
    cache?: boolean;
    report?: ReportFormat[];
    ci?: boolean;
    failOnWarning?: boolean;
    strictDynamic?: boolean;
    reportBackend?: boolean;
    backendUrl?: string;
    apiKey?: string;
    functionPatterns?: FunctionPattern[];
    outputPath?: string;
    dryRun?: boolean;

    // SDK & detection
    sdkPackages?: string[];
    allowedReceivers?: string[];
    detectionMode?: DetectionMode;
    languageOverrides?: LanguageOverrides;

    // Custom extension-to-language mapping
    extensionMappings?: Record<string, SupportedLanguage>;

    // Flag key filtering
    minFlagKeyLength?: number;

    // Delimiter config
    delimiters?: DelimiterConfig;

    // Flag aliases
    aliases?: AliasConfig;

    // Defensive limits
    limits?: Partial<DefensiveLimits>;
}

// -- Confidence Scoring --

export type DetectionStrategy =
    | 'import+type'
    | 'import+receiver'
    | 'import'
    | 'receiver'
    | 'namespace'
    | 'require+receiver'
    | 'pattern-only'
    | 'regex-fallback';

export interface ConfidenceDetail {
    confidenceScore: number;
    languageTier: LanguageTier;
    detectionStrategy: DetectionStrategy;
}

// -- Flag Usage --

export interface FlagUsage {
    flagName: string;
    filePath: string;
    line: number;
    column: number;
    language: SupportedLanguage;
    methodName: string;
    requestedType: string;
    category: FunctionCategory;
    isStrict: boolean;
    validation: ValidationIssue[];
    confidenceScore: number;
    languageTier: LanguageTier;
    detectionStrategy: DetectionStrategy;
    codeSnippet: string;
    codeUrl: string;
    isDynamic: boolean;
}

// -- Git Metadata --

export interface GitMetadata {
    repository: string;
    branch: string;
    commit: string;
    remoteUrl: string;
    gitRoot: string; // Absolute path to the git repository root
}

export interface BlameInfo {
    author: string;
    email: string;
    date: string;
    commitHash: string;
}

// -- Code Link --

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

// -- Scan Report --

export interface ScanReport {
    metadata: {
        repository: string;
        branch: string;
        commit: string;
        remoteUrl: string;
        scanTime: string;
        toolVersion: string;
    };
    usages: FlagUsage[];
    summary: {
        totalFilesScanned: number;
        totalUsages: number;
        errors: number;
        warnings: number;
        unusedFlags: string[];
        omittedShortFlagKeys: string[];
        truncatedFiles: number;
    };
}

// -- Scanner Plugin Interface --

export type SupportedLanguage =
    | 'typescript'
    | 'javascript'
    | 'dart'
    | 'lua'
    | 'c'
    | 'cpp'
    | 'csharp'
    | 'java'
    | 'kotlin'
    | 'rust'
    | 'ruby'
    | 'python'
    | 'go'
    | 'swift'
    | 'php';

export interface RawFlagReference {
    flagName: string;
    filePath: string;
    line: number;
    column: number;
    methodName: string;
    requestedType: string;
    category: FunctionCategory;
    isStrict: boolean;
    codeSnippet: string;
    isDynamic: boolean;

    // Confidence fields
    confidenceScore: number;
    languageTier: LanguageTier;
    detectionStrategy: DetectionStrategy;
}

export interface LanguageScanner {
    readonly language: SupportedLanguage;
    readonly extensions: string[];
    readonly tierInfo: LanguageTierInfo;
    scan(
        filePath: string,
        content: string,
        patterns: FunctionPattern[],
        config: ScanConfig,
        globalAliases?: Map<string, string>,
    ): RawFlagReference[];
    collectAliases?(content: string): Map<string, string>;
}

// -- Cache --

export interface CacheEntry {
    fileHash: string;
    lastModified: number;
    references: RawFlagReference[];
}

export interface CacheStore {
    version: string;
    entries: Record<string, CacheEntry>;
}
