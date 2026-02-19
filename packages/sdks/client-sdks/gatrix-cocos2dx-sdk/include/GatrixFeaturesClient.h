#ifndef GATRIX_FEATURES_CLIENT_H
#define GATRIX_FEATURES_CLIENT_H

#include "GatrixEventEmitter.h"
#include "GatrixEvents.h"
#include "GatrixFlagProxy.h"
#include "GatrixTypes.h"
#include "GatrixVariationProvider.h"
#include <functional>
#include <map>
#include <string>
#include <vector>

namespace gatrix {

class WatchFlagGroup;

/**
 * FeaturesClient - Feature flags client for Gatrix Cocos2d-x SDK (from
 * CLIENT_SDK_SPEC.md)
 *
 * Handles feature flag fetching, caching, and access.
 * All flag access methods are synchronous and read from in-memory cache.
 */
class FeaturesClient : public IVariationProvider {
public:
  FeaturesClient(const GatrixClientConfig &config, GatrixEventEmitter &emitter);
  ~FeaturesClient();

  // ==================== Context Management ====================
  GatrixContext getContext() const;
  void updateContext(const GatrixContext &context);

  // ==================== Flag Access - Basic ====================
  bool isEnabled(const std::string &flagName, bool forceRealtime = false);
  Variant getVariant(const std::string &flagName, bool forceRealtime = false);
  std::vector<EvaluatedFlag> getAllFlags() const;

  // ==================== Flag Access - Typed Variations (fallbackValue
  // REQUIRED)
  // ====================
  std::string variation(const std::string &flagName,
                        const std::string &fallbackValue,
                        bool forceRealtime = false);
  bool boolVariation(const std::string &flagName, bool fallbackValue,
                     bool forceRealtime = false);
  std::string stringVariation(const std::string &flagName,
                              const std::string &fallbackValue,
                              bool forceRealtime = false);
  int intVariation(const std::string &flagName, int fallbackValue,
                   bool forceRealtime = false);
  float floatVariation(const std::string &flagName, float fallbackValue,
                       bool forceRealtime = false);
  double doubleVariation(const std::string &flagName, double fallbackValue,
                         bool forceRealtime = false);
  std::string jsonVariation(const std::string &flagName,
                            const std::string &fallbackValue,
                            bool forceRealtime = false);

  // ==================== Variation Details (fallbackValue REQUIRED)
  // ====================
  VariationResult<bool> boolVariationDetails(const std::string &flagName,
                                             bool fallbackValue,
                                             bool forceRealtime = false);
  VariationResult<std::string>
  stringVariationDetails(const std::string &flagName,
                         const std::string &fallbackValue,
                         bool forceRealtime = false);
  VariationResult<int> intVariationDetails(const std::string &flagName,
                                           int fallbackValue,
                                           bool forceRealtime = false);
  VariationResult<float> floatVariationDetails(const std::string &flagName,
                                               float fallbackValue,
                                               bool forceRealtime = false);
  VariationResult<double> doubleVariationDetails(const std::string &flagName,
                                                 double fallbackValue,
                                                 bool forceRealtime = false);
  VariationResult<std::string>
  jsonVariationDetails(const std::string &flagName,
                       const std::string &fallbackValue,
                       bool forceRealtime = false);

  // ==================== Strict Variations (Throw on missing)
  // ====================
  bool boolVariationOrThrow(const std::string &flagName,
                            bool forceRealtime = false);
  std::string stringVariationOrThrow(const std::string &flagName,
                                     bool forceRealtime = false);
  float floatVariationOrThrow(const std::string &flagName,
                              bool forceRealtime = false);
  int intVariationOrThrow(const std::string &flagName,
                          bool forceRealtime = false);
  double doubleVariationOrThrow(const std::string &flagName,
                                bool forceRealtime = false);
  std::string jsonVariationOrThrow(const std::string &flagName,
                                   bool forceRealtime = false);

  // ==================== IVariationProvider Metadata Implementation
  // ====================
  bool hasFlagInternal(const std::string &flagName,
                       bool forceRealtime = false) const override;
  ValueType getValueTypeInternal(const std::string &flagName,
                                 bool forceRealtime = false) const override;
  int getVersionInternal(const std::string &flagName,
                         bool forceRealtime = false) const override;
  std::string getReasonInternal(const std::string &flagName,
                                bool forceRealtime = false) const override;
  bool getImpressionDataInternal(const std::string &flagName,
                                 bool forceRealtime = false) const override;
  const EvaluatedFlag *
  getRawFlagInternal(const std::string &flagName,
                     bool forceRealtime = false) const override;

  // ==================== IVariationProvider Implementation ====================
  bool isEnabledInternal(const std::string &flagName,
                         bool forceRealtime = false) override;
  Variant getVariantInternal(const std::string &flagName,
                             bool forceRealtime = false) override;

  std::string variationInternal(const std::string &flagName,
                                const std::string &fallbackValue,
                                bool forceRealtime = false) override;
  bool boolVariationInternal(const std::string &flagName, bool fallbackValue,
                             bool forceRealtime = false) override;
  std::string stringVariationInternal(const std::string &flagName,
                                      const std::string &fallbackValue,
                                      bool forceRealtime = false) override;
  float floatVariationInternal(const std::string &flagName, float fallbackValue,
                               bool forceRealtime = false) override;
  int intVariationInternal(const std::string &flagName, int fallbackValue,
                           bool forceRealtime = false) override;
  double doubleVariationInternal(const std::string &flagName,
                                 double fallbackValue,
                                 bool forceRealtime = false) override;
  std::string jsonVariationInternal(const std::string &flagName,
                                    const std::string &fallbackValue,
                                    bool forceRealtime = false) override;

  VariationResult<bool>
  boolVariationDetailsInternal(const std::string &flagName, bool fallbackValue,
                               bool forceRealtime = false) override;
  VariationResult<std::string>
  stringVariationDetailsInternal(const std::string &flagName,
                                 const std::string &fallbackValue,
                                 bool forceRealtime = false) override;
  VariationResult<float>
  floatVariationDetailsInternal(const std::string &flagName,
                                float fallbackValue,
                                bool forceRealtime = false) override;
  VariationResult<int>
  intVariationDetailsInternal(const std::string &flagName, int fallbackValue,
                              bool forceRealtime = false) override;
  VariationResult<double>
  doubleVariationDetailsInternal(const std::string &flagName,
                                 double fallbackValue,
                                 bool forceRealtime = false) override;
  VariationResult<std::string>
  jsonVariationDetailsInternal(const std::string &flagName,
                               const std::string &fallbackValue,
                               bool forceRealtime = false) override;

  bool boolVariationOrThrowInternal(const std::string &flagName,
                                    bool forceRealtime = false) override;
  std::string
  stringVariationOrThrowInternal(const std::string &flagName,
                                 bool forceRealtime = false) override;
  float floatVariationOrThrowInternal(const std::string &flagName,
                                      bool forceRealtime = false) override;
  int intVariationOrThrowInternal(const std::string &flagName,
                                  bool forceRealtime = false) override;
  double doubleVariationOrThrowInternal(const std::string &flagName,
                                        bool forceRealtime = false) override;
  std::string jsonVariationOrThrowInternal(const std::string &flagName,
                                           bool forceRealtime = false) override;

  // ==================== FlagProxy Access ====================
  bool hasFlag(const std::string &flagName) const;

  // ==================== Explicit Sync Mode ====================
  bool isExplicitSync() const;
  bool canSyncFlags() const;
  bool hasPendingSyncFlags() const;
  void setExplicitSyncMode(bool enabled);
  void syncFlags(bool fetchNow = false);

  // ==================== Watch Pattern ====================
  using WatchCallback = std::function<void(FlagProxy)>;
  std::function<void()> watchRealtimeFlag(const std::string &flagName,
                                          WatchCallback callback,
                                          const std::string &name = "");
  std::function<void()>
  watchRealtimeFlagWithInitialState(const std::string &flagName,
                                    WatchCallback callback,
                                    const std::string &name = "");
  WatchFlagGroup *createWatchFlagGroup(const std::string &name);

  // ==================== Lifecycle ====================
  void start();
  void stop();
  void fetchFlags();

  // ==================== Statistics ====================
  GatrixSdkStats getStats() const;

private:
  const GatrixClientConfig &_config;
  GatrixEventEmitter &_emitter;
  GatrixContext _context;
  IStorageProvider *_storage = nullptr;
  InMemoryStorageProvider _defaultStorage;

  // Flag storage (Repository pattern)
  std::map<std::string, EvaluatedFlag> _realtimeFlags;
  std::map<std::string, EvaluatedFlag> _synchronizedFlags;

  // State
  SdkState _sdkState = SdkState::INITIALIZING;
  bool _started = false;
  bool _readyEventEmitted = false;
  bool _hasPendingChanges = false;
  bool _pendingSync = false;
  bool _explicitSyncMode = false; // Mutable copy for runtime switching
  std::string _etag;
  std::string _connectionId;
  std::string _lastError;
  int _consecutiveFailures = 0;
  bool _pollingStopped = false;

  // Stats
  GatrixSdkStats _stats;

  // Watch groups
  std::vector<WatchFlagGroup *> _watchGroups;

  // Watch callbacks — direct callback management (not via emitter)
  std::map<std::string, std::vector<WatchCallback>> _watchCallbacks;
  std::map<std::string, std::vector<WatchCallback>> _syncedWatchCallbacks;

  // Active flags getter
  const std::map<std::string, EvaluatedFlag> &
  selectFlags(bool forceRealtime = false) const;

  // Shared flag lookup with full metrics tracking (missing, access, impression)
  const EvaluatedFlag *lookupFlag(const std::string &flagName,
                                  const std::string &eventType,
                                  bool forceRealtime = false);

  // Internal
  FlagProxy createProxy(const std::string &flagName, bool forceRealtime = true);
  void initFromStorage();
  void initFromBootstrap();
  void saveToStorage();
  void setFlags(const std::vector<EvaluatedFlag> &flags,
                bool forceSync = false);
  void onFetchResponse(int statusCode, const std::string &body,
                       const std::string &etag);
  void onFetchError(int statusCode, const std::string &error);
  void trackAccess(const std::string &flagName, bool enabled,
                   const std::string &variantName,
                   const std::string &eventType);
  void trackImpression(const EvaluatedFlag &flag, const std::string &eventType);
  void scheduleNextRefresh();
  void unschedulePolling();
  void invokeWatchCallbacks(
      std::map<std::string, std::vector<WatchCallback>> &callbackMap,
      const std::map<std::string, EvaluatedFlag> &oldFlags,
      const std::map<std::string, EvaluatedFlag> &newFlags,
      bool forceRealtime);
};

// ==================== WatchFlagGroup ====================

class WatchFlagGroup {
public:
  WatchFlagGroup(FeaturesClient &client, const std::string &name);
  ~WatchFlagGroup();

  const std::string &getName() const { return _name; }
  int size() const { return static_cast<int>(_unwatchers.size()); }

  WatchFlagGroup &watchRealtimeFlag(const std::string &flagName,
                                    FeaturesClient::WatchCallback callback);
  WatchFlagGroup &
  watchRealtimeFlagWithInitialState(const std::string &flagName,
                                    FeaturesClient::WatchCallback callback);
  WatchFlagGroup &watchSyncedFlag(const std::string &flagName,
                                  FeaturesClient::WatchCallback callback);
  WatchFlagGroup &
  watchSyncedFlagWithInitialState(const std::string &flagName,
                                  FeaturesClient::WatchCallback callback);
  void unwatchAll();
  void destroy();

private:
  FeaturesClient &_client;
  std::string _name;
  std::vector<std::function<void()>> _unwatchers;
};

} // namespace gatrix

#endif // GATRIX_FEATURES_CLIENT_H
