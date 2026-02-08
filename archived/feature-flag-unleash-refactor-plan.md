# Feature Flag Unleash-Style Refactoring Plan

## Schema Changes (Migration 028)

- [x] Create migration file
- [x] Migration successfully applied (segments now global)

## New Schema Structure

### g_feature_flags (GLOBAL)

- id, flagName (UNIQUE), displayName, description, flagType, isArchived, variantType, etc.
- NO environment column

### g_feature_flag_environments (NEW - PER ENV)

- id, flagId, environment, isEnabled, lastSeenAt
- UNIQUE(flagId, environment)

### g_feature_strategies (PER ENV)

- Added: environment column
- flagId + environment = specific env's strategies

### g_feature_variants (PER ENV)

- Added: environment column
- flagId + environment = specific env's variants

### g_feature_segments (GLOBAL)

- Removed: environment column
- segmentName is now UNIQUE globally

### g_feature_context_fields (GLOBAL - unchanged)

- Already global, no changes needed

---

## Backend Changes Required

### 1. Models (packages/backend/src/models/FeatureFlag.ts)

- [x] Update FeatureFlagAttributes - remove environment
- [x] Add FeatureFlagEnvironmentAttributes interface
- [x] Update FeatureStrategyAttributes - add environment
- [x] Update FeatureVariantAttributes - add environment
- [x] Update FeatureSegmentAttributes - remove environment
- [x] Add FeatureFlagEnvironmentModel class
- [x] Update FeatureFlagModel methods:
  - findAll: now returns global flags with per-env enabled status (JOIN)
  - findByName: takes flagName only, returns with env settings
  - create: creates global flag, then env settings
  - findById: accepts optional environment param
- [x] Add FeatureStrategyModel.findByFlagIdAndEnvironment
- [x] Add FeatureVariantModel.findByFlagIdAndEnvironment
- [x] Update FeatureSegmentModel - remove environment from findAll, findByName, create

### 2. Services

- [ ] FeatureFlagService.ts - partially done, need more edits
  - [x] listSegments - remove environment param
  - [x] createSegment - remove environment
  - [x] CreateSegmentInput - remove environment
  - [ ] Other methods using segments
- [ ] FeatureEvaluator.ts - needs isEnabled handling fix

### 3. Controllers

- [ ] FeatureFlagController.ts
- [ ] ServerApiController.ts (Server SDK API)

### 4. API Routes

- [ ] Might need new endpoints for environment-specific toggle

---

## Frontend Changes Required

### 1. Types

- [ ] Update FeatureFlag types

### 2. Pages

- [ ] FeatureFlagsPage.tsx - show per-env toggles
- [ ] FeatureFlagDetailPage.tsx - env-specific strategies/variants
- [ ] FeatureSegmentsPage.tsx - remove environment dependency

### 3. API calls

- [ ] Adjust for new API structure

---

## Server SDK Changes

### 1. Types

- [ ] Update featureFlags.ts types

### 2. Services

- [ ] FeatureFlagService.ts - adjust API calls

---

## Testing Checklist

1. [ ] Run migration on dev DB
2. [ ] Backend builds without errors
3. [ ] Frontend builds without errors
4. [ ] SDK builds without errors
5. [ ] Create flag in UI
6. [ ] Toggle flag per environment
7. [ ] Add strategies per environment
8. [ ] Evaluate flag via SDK
9. [ ] Segments work globally
