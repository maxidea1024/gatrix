# AQL Aggregate Functions Specification

> Argus Query Language (AQL) — Aggregate Function Reference

## Overview

AQL supports aggregate functions that compute summary statistics over event data.
Aggregate chips appear in the query editor as `func(field) op value` tokens,
e.g. `count() > 100`, `avg(duration) >= 500`, `uniq(type) > 10`.

## Aggregate Function Definition

Each aggregate function is defined via `AggregateFunctionDef` (see `types.ts`):

```typescript
interface AggregateFunctionDef {
  name: string;                            // Function name (lowercase)
  label: string;                           // i18n key for display label
  description: string;                     // i18n key for tooltip
  args: {
    name: string;
    type: 'field' | 'number' | 'duration'; // Argument type
    required: boolean;
  }[];
  returnType: 'number' | 'percentage' | 'duration' | 'string';
}
```

## Return Types & Valid Operators

The `returnType` field determines which comparison operators are valid for the
aggregate's result value. This mapping is defined in `fields.ts`:

| returnType   | Valid Operators                      | Example                      |
|--------------|--------------------------------------|------------------------------|
| `number`     | `=` `!=` `>` `>=` `<` `<=`          | `count() > 100`              |
| `percentage` | `=` `!=` `>` `>=` `<` `<=`          | `failure_rate() > 0.05`      |
| `duration`   | `=` `!=` `>` `>=` `<` `<=`          | `p95(duration) > 500`        |
| `string`     | `=` `!=` `contains` `!contains`     | *(reserved for future use)*  |

> **Design Note**: `percentage` and `duration` are semantically different from
> `number` but all resolve to numeric comparison operators. The `string` type
> is reserved for future aggregate functions that return non-numeric values
> (e.g. `most_common(field)`, `first(field)`). When such functions are added,
> the UI will automatically restrict operators to equality/containment.

## Current Aggregate Functions

| Name             | Args         | Return Type  | Description                |
|------------------|--------------|--------------|----------------------------|
| `count`          | *(none)*     | `number`     | Total event count          |
| `avg`            | `field`      | `number`     | Field average              |
| `sum`            | `field`      | `number`     | Field sum                  |
| `min`            | `field`      | `number`     | Field minimum              |
| `max`            | `field`      | `number`     | Field maximum              |
| `uniq`           | `field`      | `number`     | Unique value count         |
| `p50`            | `field`      | `duration`   | 50th percentile (median)   |
| `p75`            | `field`      | `duration`   | 75th percentile            |
| `p95`            | `field`      | `duration`   | 95th percentile            |
| `p99`            | `field`      | `duration`   | 99th percentile            |
| `failure_rate`   | *(none)*     | `percentage` | Failure rate (0–1)         |
| `apdex`          | `threshold`  | `number`     | User satisfaction score    |
| `tpm`            | *(none)*     | `number`     | Transactions per minute    |
| `crash_free_rate`| *(none)*     | `percentage` | Crash-free rate (0–1)      |

## Domain Availability

Not all aggregate functions are available in every domain. Each `DomainConfig`
specifies its own `aggregates` array:

| Domain        | Available Aggregates                                              |
|---------------|-------------------------------------------------------------------|
| `logs`        | count, avg, sum, min, max, uniq, p50, p75, p95, p99               |
| `issues`      | count, uniq, avg, min, max                                        |
| `discover`    | count, avg, sum, min, max, uniq, p50–p99, failure_rate, apdex, tpm|
| `feedback`    | count, uniq, avg                                                  |
| `performance` | count, avg, p50–p99, failure_rate, apdex, tpm                     |
| `sessions`    | count, uniq, avg, crash_free_rate                                 |
| `releases`    | count, uniq                                                       |
| `traces`      | count, avg, p50–p99, uniq                                         |

## Adding a New Aggregate Function

1. **Define** the `AggregateFunctionDef` constant in `fields.ts`:
   ```typescript
   const AGG_MOST_COMMON: AggregateFunctionDef = {
     name: 'most_common',
     label: 'aql.aggregate.mostCommon',
     description: 'aql.aggregate.mostCommon.desc',
     args: [{ name: 'field', type: 'field', required: true }],
     returnType: 'string',   // ← non-numeric return
   };
   ```

2. **Add i18n keys** to `ko.ini`, `en.ini`, `zh.ini`:
   ```ini
   aql.aggregate.mostCommon=최빈값
   aql.aggregate.mostCommon.desc=가장 자주 나타나는 필드 값
   ```

3. **Register** in the target domain's `aggregates` array:
   ```typescript
   aggregates: [AGG_COUNT, AGG_UNIQ, AGG_MOST_COMMON],
   ```

4. **Operators are automatic**: The UI reads `returnType` and resolves valid
   operators via `getAggregateOperators()`. No operator hardcoding needed.

## Implementation Details

### Key Files

| File                    | Role                                              |
|-------------------------|---------------------------------------------------|
| `types.ts`              | `AggregateFunctionDef` interface                   |
| `fields.ts`             | Function definitions, operator mapping, helpers    |
| `TokenEditDropdown.tsx` | Operator menu uses `getAggregateOperators()`       |
| `FilterTokenGroup.tsx`  | Chip rendering, field type via `getAggregateFieldType()` |

### Helper Functions (exported from `fields.ts`)

```typescript
// Get the aggregate definition by function name
getAggregateDef(funcName: string, config: DomainConfig): AggregateFunctionDef | undefined

// Get valid operators for an aggregate function
getAggregateOperators(funcName: string, config: DomainConfig): string[]

// Map returnType → QueryField type ('number' | 'string')
getAggregateFieldType(funcName: string, config: DomainConfig): 'number' | 'string'
```
