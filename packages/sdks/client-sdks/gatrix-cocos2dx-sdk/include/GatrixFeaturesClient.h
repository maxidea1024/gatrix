#ifndef GATRIX_FEATURES_CLIENT_H
#define GATRIX_FEATURES_CLIENT_H

#include "GatrixEventEmitter.h"
#include "GatrixEvents.h"
#include "GatrixFlagProxy.h"
#include "GatrixTypes.h"
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
class FeaturesClient {
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

  // ==================== Flag Access - Typed Variations (defaultValue REQUIRED)
  // ====================
  std::string variation(const std::string &flagName,
                        const std::string &defaultValue);
  bool boolVariation(const std::string &flagName, bool defaultValue);
  std::string stringVariation(const std::string &flagName,
                              const std::string &defaultValue);
  double numberVariation(const std::string &flagName, double defaultValue);
  std::string jsonVariation(const std::string &flagName,
                            const std::string &defaultValue);

  // ==================== Variation Details (defaultValue REQUIRED)
  // ====================
  VariationResult<bool> boolVariationDetails(const std::string &flagName,
                                             bool defaultValue);
  VariationResult<std::string>
  stringVariationDetails(const std::string &flagName,
                         const std::string &defaultValue);
  VariationResult<double> numberVariationDetails(const std::string &flagName,
                                                 double defaultValue);

  // ==================== Strict Variations (Throw on missing)
  // ====================
  bool boolVariationOrThrow(const std::string &flagName);
  std::string stringVariationOrThrow(const std::string &flagName);
  double numberVariationOrThrow(const std::string &flagName);
  std::string jsonVariationOrThrow(const std::string &flagName);

  // ==================== FlagProxy Access ====================
  FlagProxy getFlag(const std::string &flagName);

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
  std::string _lastError;

  // Stats
  GatrixSdkStats _stats;

  // Watch groups
  std::vector<WatchFlagGroup *> _watchGroups;

  // Active flags getter
  const std::map<std::string, EvaluatedFlag> &activeFlags() const;

  // Internal
  void initFromStorage();
  void initFromBootstrap();
  void saveToStorage();
  void onFetchResponse(int statusCode, const std::string &body,
                       const std::string &etag);
  void onFetchError(int statusCode, const std::string &error);
  void trackAccess(const std::string &flagName, bool enabled,
                   const std::string &variantName);
  void trackImpression(const EvaluatedFlag &flag);
  void schedulePolling();
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
