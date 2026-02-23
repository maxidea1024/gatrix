# gatrix-flag-code-refs

**Enterprise-Grade Multi-Language Feature Flag Static Analysis & Governance Platform**

> A powerful CLI tool that scans your codebase for feature flag references, validates them against server-defined flag definitions, detects misuse, and generates rich reports -- all designed for large monorepos and CI/CD pipelines.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Options](#cli-options)
- [Configuration File](#configuration-file)
- [Language Tiers](#language-tiers)
- [Detection Modes](#detection-modes)
- [Confidence Scoring](#confidence-scoring)
- [Validation Rules](#validation-rules)
- [Reporters](#reporters)
- [CI/CD Integration](#cicd-integration)
- [Git Integration](#git-integration)
- [Custom Extension Mappings](#custom-extension-mappings)
- [SDK Package Configuration](#sdk-package-configuration)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

---

## Features

- **Multi-Language Support** -- TypeScript, JavaScript, Dart, Java, Kotlin, C#, Go, Swift, Rust, Python, Ruby, PHP, C, C++, Lua (15 languages)
- **3-Tier Language Classification** -- Different confidence levels and CI behavior per language
- **Confidence Scoring** -- 0-100 score based on import tracking, receiver validation, and pattern matching
- **Detection Modes** -- Strict, Balanced, and Aggressive modes to control false positive rates
- **Validation Engine** -- Detects undefined flags, type mismatches, archived flags, possible typos, and more
- **Rich Reporting** -- Console, JSON, HTML, and SARIF output formats
- **Deep Links** -- Auto-generated links to exact code lines (GitHub, GitLab, Bitbucket -- including self-hosted with custom ports)
- **CI/CD Ready** -- Configurable exit codes based on severity, tier, and confidence
- **Incremental Scanning** -- Git-based diff scanning for fast CI runs
- **File Hash Caching** -- Skip unchanged files across runs
- **Plugin Architecture** -- Extensible scanner registry for custom language support
- **Comment Awareness** -- Automatically ignores flag references inside comments
- **Backend Upload** -- Send scan results to Gatrix backend API
- **React/Vue/Svelte Hooks** -- Built-in support for `useFlag`, `useVariant`, `useBoolVariation`, and more
- **Optional Definitions** -- Run without `--definitions` to discover all flag references without validation
- **Flag Aliases** -- Automatic naming convention aliases (camelCase, PascalCase, snake_case, UPPER_SNAKE_CASE) + literal alias mapping
- **Defensive Limits** -- Configurable caps on file count, reference count, and line length to prevent resource exhaustion
- **Binary File Detection** -- Auto-skips binary files using null-byte heuristic
- **Line Truncation** -- Truncates minified/long lines (default 500 chars) to prevent payload bloat
- **Short Flag Key Filter** -- Omits flag keys shorter than minimum length (default 3) to reduce false positives
- **Dry Run Mode** -- `--dry-run` to scan without sending results to backend
- **Ignore Files** -- `.gatrixignore` / `.ignore` support for project-level exclusion patterns

---

## Architecture

```
+---------------+    +----------------+    +-----------------+
|   CLI Entry   |--->| Config Loader  |--->| Scanner Engine  |
|  (commander)  |    | (merge/layer)  |    | (orchestrator)  |
+---------------+    +----------------+    +--------+--------+
                                                    |
                   +--------------------------------+-----------------------------+
                   |                                |                             |
            +------v------+                  +------v------+               +------v------+
            |   Scanner   |                  |  Validator  |               |   Reporter  |
            |  Registry   |                  |   Engine    |               |   Engine    |
            |             |                  |             |               |             |
            | TS/JS  (T1) |                  | Undefined   |               | Console     |
            | Dart   (T1) |                  | Type Mismatch|              | JSON        |
            | Java   (T1) |                  | Archived    |               | HTML        |
            | Kotlin (T1) |                  | Typo Check  |               | SARIF       |
            | C#     (T1) |                  | Dynamic Flag|               | Backend     |
            | Go     (T1) |                  +-------------+               +-------------+
            | Swift  (T1) |
            | Rust   (T1) |
            | Python (T2) |
            | Ruby   (T2) |
            | PHP    (T2) |
            | C      (T2) |
            | C++    (T2) |
            | Lua    (T3) |
            +-------------+
```

---

## Installation

```bash
# Clone and install
git clone https://github.com/maxidea1024/gatrix.git
cd gatrix/tools
yarn install
yarn build

# Or install globally
npm install -g gatrix-flag-code-refs
```

### Requirements

- **Node.js** >= 18.0.0
- **Git** (for metadata, blame, and incremental scanning)

---

## Quick Start

### 1. Create a flag definitions file (optional)

```json
{
  "flags": {
    "new_shop_ui": { "type": "bool", "archived": false },
    "discount_rate": { "type": "number", "archived": false },
    "welcome_message": { "type": "string", "archived": false },
    "legacy_checkout": { "type": "bool", "archived": true }
  }
}
```

### 2. Run the scan

```bash
# Basic scan (without definitions -- discovers all flag references)
gatrix-flag-code-refs --root ./src --detection-mode aggressive

# Scan with flag validation
gatrix-flag-code-refs --definitions ./flags.json --root ./src

# CI mode with JSON output
gatrix-flag-code-refs --definitions ./flags.json --ci --report console,json --output report.json
```

### 3. Review output

The tool displays detailed per-reference analysis including:
- Flag name and location
- Confidence score and detection strategy
- Validation issues with suggestions
- Direct links to the code

---

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `[root]` | Root directory to scan (positional argument) | `.` |
| `--definitions <path>` | Path to flag definitions JSON file (optional) | -- |
| `--include <patterns...>` | Glob patterns to include | `**/*` |
| `--exclude <patterns...>` | Glob patterns to exclude | `node_modules, dist, ...` |
| `--extensions <exts>` | Comma-separated file extensions | All supported |
| `--languages <langs>` | Comma-separated language filters | All |
| `--since <ref>` | Git ref for incremental scan | -- |
| `--include-context` | Include surrounding code context | `false` |
| `--context-lines <n>` | Number of context lines | `3` |
| `--include-blame` | Include git blame info | `false` |
| `--parallel <n>` | Number of parallel workers | `4` |
| `--cache` | Enable file hash caching | `false` |
| `--report <formats>` | Report formats: `console,json,html,sarif` | `console` |
| `--output <path>` | Output file path for report | Auto-generated |
| `--ci` | Enable CI mode (exit codes) | `false` |
| `--fail-on-warning` | Fail on warnings in CI mode | `false` |
| `--strict-dynamic` | Treat dynamic flag usage as error | `false` |
| `--detection-mode <mode>` | `strict`, `balanced`, `aggressive` | `balanced` |
| `--report-backend` | Upload report to Gatrix backend | `false` |
| `--backend-url <url>` | Gatrix backend URL | -- |
| `--api-key <key>` | Gatrix API key | -- |
| `--allow-global-lua-detection` | Allow global Lua function calls | `false` |
| `--dry-run` | Run scan without sending results to backend | `false` |
| `--min-flag-key-length <n>` | Minimum flag key length (shorter keys omitted) | `3` |

---

## Configuration File

Create `.gatrix-flag-code-refs.json` in your project root for persistent configuration:

```json
{
  "definitions": "./flags.json",
  "include": ["src/**/*"],
  "exclude": ["**/test/**", "**/vendor/**"],
  "extensions": [".ts", ".tsx", ".lua"],
  "detectionMode": "balanced",
  "minFlagKeyLength": 3,
  "sdkPackages": ["@gatrix/sdk", "@mycompany/feature-flags"],
  "allowedReceivers": ["gatrix", "featureClient", "myClient"],
  "extensionMappings": {
    ".mm": "cpp",
    ".hxx": "cpp"
  },
  "delimiters": {
    "disableDefaults": false,
    "additional": []
  },
  "aliases": {
    "types": ["camelCase", "pascalCase", "snakeCase", "upperSnakeCase"],
    "literals": {
      "my-flag": ["MY_FLAG_CONST", "myFlagAlias"]
    }
  },
  "limits": {
    "maxFileCount": 10000,
    "maxReferenceCount": 25000,
    "maxLineCharCount": 500
  },
  "ci": true,
  "report": ["console", "json", "sarif"],
  "outputPath": "./reports/flag-scan.json",
  "languageOverrides": {
    "lua": {
      "sdkModules": ["gatrix", "my_feature_lib"],
      "allowGlobalCalls": false
    }
  }
}
```

**Priority**: CLI options > Config file > Defaults

---

## Language Tiers

Languages are classified into 3 tiers based on the analysis depth available:

| Tier | Languages | Import Tracking | Type Tracking | CI Behavior |
|------|-----------|-----------------|---------------|-------------|
| **Tier 1** | TypeScript, JavaScript, Dart, Java, Kotlin, C#, Go, Swift, Rust | Yes | Yes | Errors -> exit(1) |
| **Tier 2** | Python, Ruby, PHP, C, C++ | Partial | No | Errors -> exit(1) |
| **Tier 3** | Lua | Partial (require) | No | Errors -> exit(1) only with `--fail-on-warning` |

### Tier 1 -- Full Analysis
- ES module import tracking (`import ... from`)
- CommonJS require tracking (`const x = require(...)`)
- Go import block parsing
- Rust `use` / `extern crate` detection
- Swift `import` detection
- Destructured import resolution
- Const alias resolution (e.g., `const FLAG = 'my_flag'`)
- Type-safe receiver validation

### Tier 2 -- Moderate Analysis
- Python `import` / `from ... import` detection
- Ruby `require` / `require_relative` detection
- PHP `use` namespace and `require_once` detection
- C/C++ `#include` and `using namespace` detection

### Tier 3 -- Pattern-Based with Guard Rails
- Lua `require()` module tracking
- Receiver validation via `.` and `:` operators
- Global call filtering (disabled by default)

---

## Detection Modes

| Mode | Description | False Positives | Use When |
|------|-------------|-----------------|----------|
| `strict` | Requires SDK import **AND** valid receiver | Very Low | Production CI gates |
| `balanced` | Requires SDK import **OR** valid receiver | Low | Default, general development |
| `aggressive` | Function name pattern only | Higher | Exploratory scans, unknown SDKs |

---

## Confidence Scoring

Each detected flag reference receives a confidence score (0-100):

| Factor | Points | Description |
|--------|--------|-------------|
| SDK import confirmed | +50 | `import` / `require` / `#include` for a known SDK package |
| Receiver matches allowed list | +30 | e.g., `gatrix.boolVariation()` |
| Receiver present (unlisted) | +10 | Has a receiver, but not in allowed list |
| Function name pattern match | +20 | Baseline for any match |
| Literal string argument | +10 | Flag name is a static string |
| Dynamic flag reference | -20 | Variable or computed flag name |
| No receiver (Tier 3) | -30 | Global function call in Lua |

**Filtering**: Tier 3 references below confidence score 30 are automatically discarded.

---

## Validation Rules

When `--definitions` is provided, the following validation rules are applied:

| Code | Severity | Description |
|------|----------|-------------|
| `UNDEFINED_FLAG` | Error | Flag not found in definitions |
| `TYPE_MISMATCH` | Error | Accessor type != defined flag type |
| `ARCHIVED_FLAG_USAGE` | Warning | Using an archived/deprecated flag |
| `DYNAMIC_FLAG_USAGE` | Warning | Non-static flag name, cannot validate |
| `POSSIBLE_TYPO` | Warning | Similar flag name found (Levenshtein <= 2) |
| `STRICT_ACCESS_ON_WRONG_TYPE` | Error | `*OrThrow` accessor with wrong type |
| `VARIANT_ACCESS_ON_TYPED_FLAG` | Warning | Generic accessor on a typed flag |
| `WATCH_ON_NON_EXISTENT_FLAG` | Error | Observer on undefined flag |
| `UNUSED_FLAG` | Info | Flag defined but never referenced |

Without `--definitions`, the tool still discovers all flag references but skips definition-based validation.

---

## Reporters

### Console (`--report console`)
Rich terminal output with:
- Color-coded severity indicators
- Confidence distribution chart
- Tier distribution breakdown
- Deep links to code

### JSON (`--report json`)
Structured JSON report with full metadata, usages, and summary.

### HTML (`--report html`)
Dark-themed HTML report with:
- Confidence bars
- Badge-based severity indicators
- Filterable issue list
- Repository deep links

### SARIF (`--report sarif`)
SARIF 2.1.0 format for integration with:
- GitHub Code Scanning
- Azure DevOps
- Other SARIF-compatible tools

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Scan feature flag references
  run: |
    npx gatrix-flag-code-refs \
      --definitions ./flags.json \
      --ci \
      --detection-mode balanced \
      --report console,sarif \
      --output flag-scan.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: flag-scan.sarif
```

### GitLab CI

```yaml
flag-scan:
  script:
    - npx gatrix-flag-code-refs
        --definitions ./flags.json
        --ci
        --report console,json
        --output flag-report.json
  artifacts:
    reports:
      codequality: flag-report.json
```

### Incremental Scanning

```bash
# Only scan files changed since main branch
gatrix-flag-code-refs --definitions ./flags.json --since origin/main --ci
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No issues (or not in CI mode) |
| `1` | Validation errors detected |
| `2` | Fatal error (config, parse, etc.) |

---

## Git Integration

Git operations use the **simple-git** SDK (not raw shell commands) for reliability:

- **Metadata**: Repository name, branch, commit hash, remote URL, git root
- **Incremental Scan**: `--since <ref>` for diff-based file discovery
- **Blame**: Line-level authorship via `git blame --porcelain`
- **Deep Links**: Auto-generated from remote URL, supporting:
  - GitHub.com / GitHub Enterprise
  - GitLab.com / Self-hosted GitLab CE/EE
  - Bitbucket Cloud / Bitbucket Server
  - Gitea and other self-hosted platforms (fallback to GitLab URL pattern)
  - Custom ports (e.g., `http://host:30080/group/repo`)
  - HTTP and HTTPS schemes preserved

---

## Custom Extension Mappings

Map unusual file extensions to supported languages:

```json
{
  "extensionMappings": {
    ".mm": "cpp",
    ".hxx": "cpp",
    ".mjs": "javascript",
    ".cts": "typescript",
    ".pyw": "python"
  }
}
```

Built-in extension mappings:

| Language | Extensions |
|----------|-----------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx` |
| Dart | `.dart` |
| Lua | `.lua` |
| C | `.c`, `.h` |
| C++ | `.cpp`, `.cxx`, `.cc`, `.hpp`, `.hh` |
| C# | `.cs` |
| Java | `.java` |
| Kotlin | `.kt`, `.kts` |
| Go | `.go` |
| Swift | `.swift` |
| Rust | `.rs` |
| Python | `.py` |
| Ruby | `.rb` |
| PHP | `.php` |

---

## SDK Package Configuration

Tell the scanner which SDK packages to look for in import statements:

```json
{
  "sdkPackages": [
    "@gatrix/sdk",
    "@gatrix/client",
    "@gatrix/react",
    "@gatrix/vue",
    "@gatrix/svelte",
    "@mycompany/feature-flags"
  ],
  "allowedReceivers": [
    "gatrix",
    "flagClient",
    "featureClient",
    "features",
    "client",
    "sdk"
  ]
}
```

### Built-in Function Patterns

The tool recognizes these function/method patterns by default:

**Core Access**: `isEnabled`, `getVariant`, `getFlag`, `watchFlag`, `watchFlagWithInitialState`

**Typed Variation**: `variation`, `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation`

**Variation Details**: `boolVariationDetails`, `stringVariationDetails`, `numberVariationDetails`, `jsonVariationDetails`

**Strict**: `boolVariationOrThrow`, `stringVariationOrThrow`, `numberVariationOrThrow`, `jsonVariationOrThrow`

**React/Vue Hooks**: `useFlag`, `useFlagProxy`, `useVariant`, `useBoolVariation`, `useStringVariation`, `useNumberVariation`, `useJsonVariation`

**Svelte Stores**: `flag`, `flagState`, `variant`

---

## Project Structure

```
src/
  cli.ts                      # CLI entry point (commander)
  types.ts                    # Core TypeScript interfaces
  utils.ts                    # Shared utility functions
  config/
    defaults.ts               # Default configuration values
    loader.ts                 # Config file + CLI merge logic
    index.ts
  scanners/
    regexScanner.ts           # Base scanner with confidence scoring
    typescriptScanner.ts      # TS/JS Tier 1 scanner
    languageScanners.ts       # All other language scanners
    registry.ts               # Plugin-based scanner registry
    index.ts
  validators/
    validatorEngine.ts        # Validation rules engine
    index.ts
  git/
    diff.ts                   # Git diff (simple-git)
    blame.ts                  # Git blame (simple-git)
    metadata.ts               # Repository metadata (simple-git)
    linkGenerator.ts          # Deep link generation
    index.ts
  reporters/
    consoleReporter.ts        # Terminal output
    jsonReporter.ts           # JSON report
    htmlReporter.ts           # HTML report
    sarifReporter.ts          # SARIF 2.1.0 report
    index.ts
  core/
    scannerEngine.ts          # Main orchestrator
    reporterEngine.ts         # Report routing + CI exit codes
    index.ts
  cache/
    scanCache.ts              # File hash caching
    index.ts
  backend/
    client.ts                 # Backend API upload
    index.ts
```

## Ignore Files

Create `.gatrixignore` or `.ignore` in your project root:

```
# Exclude generated code
generated/
*.generated.ts

# Exclude vendored dependencies
vendor/
third_party/

# Exclude minified files
*.min.js
*.min.css
```

Patterns follow .gitignore syntax.

---

## Flag Aliases

The tool automatically generates naming convention aliases for flag keys:

| Flag Key | camelCase | PascalCase | snake_case | UPPER_SNAKE_CASE |
|----------|-----------|------------|------------|------------------|
| `my-flag-name` | `myFlagName` | `MyFlagName` | `my_flag_name` | `MY_FLAG_NAME` |
| `new_shop_ui` | `newShopUi` | `NewShopUi` | `new_shop_ui` | `NEW_SHOP_UI` |

This means if a developer uses `MY_FLAG_NAME` in code but the flag is defined as `my-flag-name`, the reference will still be correctly matched.

Configure in `.gatrix-flag-code-refs.json`:

```json
{
  "aliases": {
    "types": ["camelCase", "pascalCase", "snakeCase", "upperSnakeCase", "kebabCase", "dotCase"],
    "literals": {
      "my-flag": ["FEATURE_X", "flagX"]
    }
  }
}
```

---

## Defensive Limits

The tool enforces defensive limits to prevent excessive resource usage on large repositories:

| Limit | Default | Description |
|-------|---------|-------------|
| `maxFileCount` | 10000 | Maximum number of files to scan |
| `maxReferenceCount` | 25000 | Maximum number of total code references |
| `maxLineCharCount` | 500 | Maximum characters per line (lines are truncated) |

Configure in `.gatrix-flag-code-refs.json`:

```json
{
  "limits": {
    "maxFileCount": 20000,
    "maxReferenceCount": 50000,
    "maxLineCharCount": 1000
  }
}
```

---

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Format code (Prettier, single quotes, 2-space indent)
yarn format

# Check formatting
yarn format:check

# Run locally
node dist/cli.js --root ./src --detection-mode aggressive
```

---

## License

MIT
