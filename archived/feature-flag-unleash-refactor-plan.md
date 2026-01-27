# Feature Flag Unleash-Style Refactoring Plan

## Schema Changes (Migration 028)
- [x] Create migration file

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
- [ ] Update FeatureFlagAttributes - remove environment
- [ ] Add FeatureFlagEnvironmentAttributes interface
- [ ] Update FeatureStrategyAttributes - add environment
- [ ] Update FeatureVariantAttributes - add environment
- [ ] Update FeatureSegmentAttributes - remove environment
- [ ] Update FeatureFlagModel methods:
  - findAll: now returns global flags with per-env enabled status
  - findByName: takes flagName only, returns with all env settings
  - create: creates global flag, then env settings
  - etc.

### 2. Services
- [ ] FeatureFlagService.ts - major refactor
- [ ] FeatureEvaluator.ts - adjust for new schema

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

