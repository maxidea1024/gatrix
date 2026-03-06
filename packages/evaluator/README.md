# @gatrix/evaluator

Feature flag evaluation engine for the Gatrix platform.

## Purpose

This package contains the **runtime evaluation logic** for feature flags. Given a flag definition and user context, it determines flag enablement, selects variants, calculates rollout percentages, and evaluates targeting strategies.

Key contents:
- **FeatureFlagEvaluator** — Core evaluation class. Evaluates strategies, constraints, segments, and rollout percentages to produce a final flag result
- **EvaluationUtils** — Utilities for extracting evaluation context from requests, generating ETags, and formatting responses
- **Strategies** — Targeting strategy implementations: FlexibleRollout, GradualRollout (userId/sessionId/random), UserWithId, RemoteAddress, ApplicationHostname, etc.

## Why a Separate Package?

The evaluation engine depends on **Node.js-specific modules** such as `murmurhash` (hash-based rollout) and `crypto` (ETag generation). These dependencies **cannot be used in browser environments**, so the evaluation logic must be separated from the shared type definitions.

The split works as follows:
- `@gatrix/shared` — **Types and constants** shared by all packages (browser-safe)
- `@gatrix/evaluator` — **Evaluation engine** for server-side use only (Node.js)

This allows the frontend to depend only on `@gatrix/shared` for type definitions, while the backend and server-sdk additionally depend on `@gatrix/evaluator` for actual flag evaluation.

## Installation

```bash
# Within the monorepo (workspace dependency)
yarn add @gatrix/evaluator
```

## Usage

```typescript
// Evaluator
import { FeatureFlagEvaluator } from '@gatrix/evaluator';
import type { FeatureFlag, EvaluationContext, FeatureSegment } from '@gatrix/shared';

const result = FeatureFlagEvaluator.evaluate(flag, context, segmentsMap);

// EvaluationUtils
import { EvaluationUtils } from '@gatrix/evaluator';

const { context, flagNames } = EvaluationUtils.extractFromRequest(req);

// Strategy functions
import { evaluateStrategyIsEnabled, normalizedStrategyValue } from '@gatrix/evaluator';
```

## Dependencies

| Package          | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `@gatrix/shared` | Feature flag type definitions and constants            |
| `murmurhash`     | Hash-based rollout percentage calculation (stickiness) |
