# gatrix-stale-flag-cleaner

A CLI tool to detect and report **stale feature flags** in Gatrix projects, and find their references in your codebase so they can be safely removed.

---

## Prerequisites

- **Node.js** >= 18
- **Yarn**
- A running Gatrix backend instance and a server API key

---

## Installation

```bash
# From the package directory
yarn install
yarn build

# Run directly
node dist/cli.js --help

# Or via the bin alias (after linking)
yarn link
gatrix-stale-flag-cleaner --help
```

---

## Commands

### `fetch` — Retrieve stale flags from the backend

Queries the Gatrix backend and outputs flags that are candidates for removal:

- **Archived** flags (always stale)
- Flags **100% enabled** for more than `--stale-days` days
- Flags **fully disabled** (0% rollout) for more than `--stale-days` days
- **Inactive** flags (no environment data) older than `--stale-days` days

```bash
gatrix-stale-flag-cleaner fetch \
  --backend-url https://your-gatrix.com \
  --api-key YOUR_SERVER_KEY \
  --stale-days 30

# Write stale flag list to file (compatible with --input in report command)
gatrix-stale-flag-cleaner fetch \
  --backend-url https://your-gatrix.com \
  --api-key YOUR_SERVER_KEY \
  --output stale-flags.json
```

| Option | Description | Default |
|--------|-------------|---------|
| `--backend-url` | Gatrix backend URL | *(required)* |
| `--api-key` | Server API key | *(required)* |
| `--stale-days` | Days since last update to consider a flag stale | `30` |
| `--output` | Write results to a JSON file | stdout |
| `--json` | Output as JSON | false |

---

### `scan` — Find references to a specific flag in the codebase

Searches source files for all naming-convention variants of the flag key
(original, camelCase, PascalCase, snake\_case, SCREAMING\_SNAKE\_CASE, kebab-case).

```bash
gatrix-stale-flag-cleaner scan \
  --flag my-old-feature \
  --root ./src

# JSON output
gatrix-stale-flag-cleaner scan \
  --flag my-old-feature \
  --root ./src \
  --json
```

| Option | Description | Default |
|--------|-------------|---------|
| `--flag` | Feature flag key to search for | *(required)* |
| `--root` | Root directory to scan | `.` |
| `--include` | Glob patterns to include | common source extensions |
| `--exclude` | Glob patterns to exclude | `node_modules`, `dist`, etc. |
| `--output` | Write results to a JSON file | stdout |
| `--json` | Output as JSON | false |

---

### `report` — Combined stale flag + code reference report

Fetches stale flags (or reads from `--input`) and scans the codebase in a single
efficient pass. Produces a full report showing which flags are safe to delete and
which still have code references needing cleanup.

```bash
# Using the backend
gatrix-stale-flag-cleaner report \
  --backend-url https://your-gatrix.com \
  --api-key YOUR_SERVER_KEY \
  --root ./src

# Using a pre-fetched file
gatrix-stale-flag-cleaner report \
  --input stale-flags.json \
  --root ./src

# Write JSON report
gatrix-stale-flag-cleaner report \
  --input stale-flags.json \
  --root ./src \
  --output report.json
```

| Option | Description | Default |
|--------|-------------|---------|
| `--backend-url` | Gatrix backend URL | — |
| `--api-key` | Server API key | — |
| `--input` | Read stale flags from a JSON file | — |
| `--stale-days` | Stale threshold in days | `30` |
| `--root` | Root directory to scan | `.` |
| `--include` | Glob patterns to include | common source extensions |
| `--exclude` | Glob patterns to exclude | `node_modules`, `dist`, etc. |
| `--output` | Write JSON report to a file | stdout |
| `--json` | Output entire report as JSON | false |

> Either `--input` **or** `--backend-url` + `--api-key` must be provided.

---

## Input JSON Format

The `--input` file (and the output of `fetch --output`) uses this schema:

```json
[
  {
    "key": "old-checkout-flow",
    "keepBranch": "enabled",
    "reason": "100% rollout for 45 days",
    "lastModified": "2025-12-01T00:00:00.000Z"
  },
  {
    "key": "legacy-payment-modal",
    "keepBranch": "disabled",
    "reason": "Flag is archived"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Feature flag key |
| `keepBranch` | `"enabled"` \| `"disabled"` | Which code path to keep on removal |
| `reason` | string | Human-readable stale reason (optional) |
| `lastModified` | string | ISO timestamp (optional) |

---

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run in dev mode (ts-node)
yarn dev fetch --help

# Lint
yarn lint

# Auto-fix lint issues
yarn lint:fix

# Format
yarn format

# Check formatting
yarn format:check
```

> **Code style**: This project enforces ESLint (TypeScript-ESLint) and Prettier.
> Run `yarn lint` and `yarn format:check` before committing.

---

## How It Works

1. **Fetch** — Calls `GET /api/v1/server/features/definitions` on the Gatrix backend and classifies flags as stale based on `archived` state, rollout percentage, and last-modified date.
2. **Scan** — Uses `fast-glob` to enumerate source files and searches each line for the flag key in all naming-convention variants.
3. **Report** — Combines the two steps and categorises flags into:
   - **No code references** → safe to delete from the Gatrix dashboard
   - **Has code references** → requires code cleanup first

---

## License

MIT
