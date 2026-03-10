# Gatrix Backend

Gatrix Backend API — Online Game Platform Management Server built with Express/TypeScript.

## Requirements

- Node.js >= 22
- MySQL 8.0
- Redis

## Quick Start

```bash
cd packages/backend
yarn install
yarn dev
```

## Database

### Main Database (`gatrix`)

Main application database. Configured via `DB_*` environment variables.

### Crash Database (`gatrix_crash`)

Separate database for crash event tracking, isolated for load separation. Configured via `CRASH_DB_*` environment variables (falls back to `DB_*` if not set).

| Variable           | Default        | Description         |
| ------------------ | -------------- | ------------------- |
| `CRASH_DB_HOST`    | `DB_HOST`      | Crash DB host       |
| `CRASH_DB_PORT`    | `DB_PORT`      | Crash DB port       |
| `CRASH_DB_USER`    | `DB_USER`      | Crash DB user       |
| `CRASH_DB_PASSWORD`| `DB_PASSWORD`  | Crash DB password   |
| `CRASH_DB_NAME`    | `gatrix_crash` | Crash DB name       |

## Migrations

### Main Database Migrations

```bash
yarn migrate:up         # Run pending migrations
yarn migrate:status     # Show migration status
yarn migrate:rollback <id>  # Rollback specific migration
```

Migration files: `src/database/migrations/`

### Crash Database Migrations

Crash DB has its own independent migration system.

```bash
yarn migrate:crash:up         # Run pending crash migrations
yarn migrate:crash:status     # Show crash migration status
yarn migrate:crash:rollback <id>  # Rollback specific crash migration
```

Migration files: `src/database/crash-migrations/`

> **Note**: Both `yarn dev` and `yarn start` automatically run both main and crash migrations on startup.

## Development Scripts

```bash
yarn dev             # Start with hot reload (runs migrations first)
yarn dev:no-migrate  # Start without running migrations
yarn build           # Build TypeScript
yarn typecheck       # Type check only
yarn lint            # Run ESLint
yarn lint:fix        # Fix lint issues
yarn seed            # Seed database
yarn db:reset        # Reset database
```
