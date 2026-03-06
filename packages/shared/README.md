# @gatrix/shared

Shared types, constants, and utilities for the Gatrix platform.

## Purpose

This package provides **common type definitions and constants** used across multiple packages in the Gatrix monorepo (frontend, backend, server-sdk, evaluator, edge, etc.).

Key contents:
- **Feature Flag Types** — `FeatureFlag`, `FeatureStrategy`, `Constraint`, `ConstraintOperator`, `Variant`, `EvaluationContext`, and other core type definitions for the feature flag system
- **Value Source Constants** — Constants identifying the origin of evaluation result values (`VALUE_SOURCE`)
- **Error Handling** — `ErrorCodes`, `extractErrorCode`, `extractErrorMessage`, and other common error utilities
- **Permission Constants** — RBAC resource, action, and scope definitions

## Why a Separate Package?

All packages in the monorepo share the same type definitions and constants. Centralizing them here **prevents type mismatches and duplicate definitions**. For example, feature flag types like `Constraint` and `ConstraintOperator` must be identical whether used in a frontend UI component or the backend evaluation engine.

> **Note**: This package contains **no Node.js-specific code** (no `crypto`, no native modules), making it **safe to use in browser environments**. The feature flag evaluation logic lives in the separate `@gatrix/evaluator` package.

## Installation

```bash
# Within the monorepo (workspace dependency)
yarn add @gatrix/shared
```

## Usage

```typescript
// Feature flag types
import type { Constraint, ConstraintOperator, FeatureFlag } from '@gatrix/shared';

// Value source constants
import { VALUE_SOURCE } from '@gatrix/shared';

// Error handling
import { ErrorCodes, extractErrorCode } from '@gatrix/shared';

// Permission constants
import { RESOURCES, ACTIONS } from '@gatrix/shared/permissions';
```

## Exports

| Path                         | Description                                                 |
| ---------------------------- | ----------------------------------------------------------- |
| `@gatrix/shared`             | Feature flag types, value source constants, error utilities |
| `@gatrix/shared/errors`      | Error codes and error handling utilities                    |
| `@gatrix/shared/permissions` | RBAC permission constants (resources, actions, scopes)      |
