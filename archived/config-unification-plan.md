# Config Unification Plan

## Target Structure (from Unreal SDK reference)

### ClientConfig (root)
- Required: apiUrl, apiToken, appName, environment
- Optional: context, customHeaders, offlineMode, enableDevMode, cacheKeyPrefix
- features: FeaturesConfig

### FeaturesConfig (nested)
- refreshInterval (30s)
- disableRefresh (false)
- explicitSyncMode (true)
- bootstrapOverride (true)
- disableMetrics (false)
- impressionDataAll (false)
- usePOSTRequests (false)
- metricsIntervalInitial (2s)
- metricsInterval (60s)
- fetchRetryOptions: FetchRetryOptions
- disableStats (false)
- streaming: StreamingConfig

## SDKs to Update

### ✅ JS SDK - Already has FeaturesConfig separation
### ✅ Python SDK - Already has FeaturesConfig separation
### ✅ Unreal SDK - Reference implementation
### ❌ Flutter SDK - Flat structure, needs FeaturesConfig
### ❌ Cocos2d-x SDK - Flat structure, needs FeaturesConfig
### ❌ Godot SDK - Flat structure, needs FeaturesConfig
### 📝 Spec Document - Needs update to reflect nested structure
