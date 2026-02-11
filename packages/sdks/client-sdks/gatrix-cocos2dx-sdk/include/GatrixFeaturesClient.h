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
  bool isEnabled(const std::string &flagName);
  Variant getVariant(const std::string &flagName);
  std::vector<EvaluatedFlag> getAllFlags() const;

  // ==================== Flag Access - Typed Variations (missingValue REQUIRED)
  // ====================
  std::string variation(const std::string &flagName,
                        const std::string &missingValue);
  bool boolVariation(const std::string &flagName, bool missingValue);
  std::string stringVariation(const std::string &flagName,
                              const std::string &missingValue);
  int intVariation(const std::string &flagName, int missingValue);
  float floatVariation(const std::string &flagName, float missingValue);
  double doubleVariation(const std::string &flagName, double missingValue);
  std::string jsonVariation(const std::string &flagName,
                            const std::string &missingValue);

  // ==================== Variation Details (missingValue REQUIRED)
  // ====================
  VariationResult<bool> boolVariationDetails(const std::string &flagName,
                                             bool missingValue);
  VariationResult<std::string>
  stringVariationDetails(const std::string &flagName,
                         const std::string &missingValue);
  VariationResult<int> intVariationDetails(const std::string &flagName,
                                           int missingValue);
  VariationResult<float> floatVariationDetails(const std::string &flagName,
                                               float missingValue);
  VariationResult<double> doubleVariationDetails(const std::string &flagName,
                                                 double missingValue);
  VariationResult<std::string>
  jsonVariationDetails(const std::string &flagName,
                       const std::string &missingValue);

  // ==================== Strict Variations (Throw on missing)
  // ====================
  bool boolVariationOrThrow(const std::string &flagName);
  std::string stringVariationOrThrow(const std::string &flagName);
  float floatVariationOrThrow(const std::string &flagName);
  int intVariationOrThrow(const std::string &flagName);
  double doubleVariationOrThrow(const std::string &flagName);
  std::string jsonVariationOrThrow(const std::string &flagName);

  // ==================== IVariationProvider Implementation ====================
  bool isEnabledInternal(const std::string &flagName) override;
  Variant getVariantInternal(const std::string &flagName) override;

  std::string variationInternal(const std::string &flagName,
                                const std::string &missingValue) override;
  bool boolVariationInternal(const std::string &flagName,
                             bool missingValue) override;
  std::string stringVariationInternal(const std::string &flagName,
                                      const std::string &missingValue) override;
  float floatVariationInternal(const std::string &flagName,
                               float missingValue) override;
  int intVariationInternal(const std::string &flagName,
                           int missingValue) override;
  double doubleVariationInternal(const std::string &flagName,
                                 double missingValue) override;
  std::string jsonVariationInternal(const std::string &flagName,
                                    const std::string &missingValue) override;

  VariationResult<bool>
  boolVariationDetailsInternal(const std::string &flagName,
                               bool missingValue) override;
  VariationResult<std::string>
  stringVariationDetailsInternal(const std::string &flagName,
                                 const std::string &missingValue) override;
  VariationResult<float>
  floatVariationDetailsInternal(const std::string &flagName,
                                float missingValue) override;
  VariationResult<int> intVariationDetailsInternal(const std::string &flagName,
                                                   int missingValue) override;
  VariationResult<double>
  doubleVariationDetailsInternal(const std::string &flagName,
                                 double missingValue) override;
  VariationResult<std::string>
  jsonVariationDetailsInternal(const std::string &flagName,
                               const std::string &missingValue) override;

  bool boolVariationOrThrowInternal(const std::string &flagName) override;
  std::string
  stringVariationOrThrowInternal(const std::string &flagName) override;
  float floatVariationOrThrowInternal(const std::string &flagName) override;
  int intVariationOrThrowInternal(const std::string &flagName) override;
  double doubleVariationOrThrowInternal(const std::string &flagName) override;
  std::string
  jsonVariationOrThrowInternal(const std::string &flagName) override;

  // ==================== FlagProxy Access ====================
  FlagProxy getFlag(const std::string &flagName);
  bool hasFlag(const std::string &flagName) const;

  // ==================== Explicit Sync Mode ====================
  bool isExplicitSync() const;
  bool canSyncFlags() const;
  void syncFlags(bool fetchNow = false);

  // ==================== Watch Pattern ====================
  using WatchCallback = std::function<void(FlagProxy)>;
  std::function<void()> watchFlag(const std::string &flagName,
                                  WatchCallback callback,
                                  const std::string &name = "");
  std::function<void()> watchFlagWithInitialState(const std::string &flagName,
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
  std::string _etag;
  std::string _connectionId;
  std::string _lastError;
  int _consecutiveFailures = 0;
  bool _pollingStopped = false;

  // Stats
  GatrixSdkStats _stats;

  // Watch groups
  std::vector<WatchFlagGroup *> _watchGroups;

  // Active flags getter
  const std::map<std::string, EvaluatedFlag> &activeFlags() const;

  // Shared flag lookup with full metrics tracking (missing, access, impression)
  const EvaluatedFlag *lookupFlag(const std::string &flagName,
                                  const std::string &eventType);

  // Internal
  void initFromStorage();
  void initFromBootstrap();
  void saveToStorage();
  void onFetchResponse(int statusCode, const std::string &body,
                       const std::string &etag);
  void onFetchError(int statusCode, const std::string &error);
  void trackAccess(const std::string &flagName, bool enabled,
                   const std::string &variantName,
                   const std::string &eventType);
  void trackImpression(const EvaluatedFlag &flag, const std::string &eventType);
  void scheduleNextRefresh();
  void unschedulePolling();
};

// ==================== WatchFlagGroup ====================

class WatchFlagGroup {
public:
  WatchFlagGroup(FeaturesClient &client, const std::string &name);
  ~WatchFlagGroup();

  const std::string &getName() const { return _name; }
  int size() const { return static_cast<int>(_unwatchers.size()); }

  WatchFlagGroup &watchFlag(const std::string &flagName,
                            FeaturesClient::WatchCallback callback);
  WatchFlagGroup &
  watchFlagWithInitialState(const std::string &flagName,
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
