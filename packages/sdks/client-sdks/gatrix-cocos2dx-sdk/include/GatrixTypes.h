#ifndef GATRIX_TYPES_H
#define GATRIX_TYPES_H

#include <chrono>
#include <functional>
#include <map>
#include <string>
#include <vector>

namespace gatrix {

// ==================== Enums ====================

enum class VariantType { NONE, STRING, NUMBER, JSON };

enum class SdkState { INITIALIZING, READY, HEALTHY, ERROR, STOPPED };

// ==================== Data Structures ====================

struct Variant {
  std::string name;
  bool enabled = false;
  std::string payload; // raw payload string

  static Variant fallbackDisabled() {
    Variant v;
    v.name = "disabled";
    v.enabled = false;
    return v;
  }
};

struct EvaluatedFlag {
  std::string name;
  bool enabled = false;
  Variant variant;
  VariantType variantType = VariantType::NONE;
  int version = 0;
  std::string reason;
  bool impressionData = false;
};

template <typename T> struct VariationResult {
  T value;
  std::string reason;
  bool flagExists = false;
  bool enabled = false;
};

struct GatrixContext {
  std::string userId;
  std::string sessionId;
  std::string deviceId;
  std::string currentTime;
  std::map<std::string, std::string> properties;
};

struct ImpressionEvent {
  std::string featureName;
  bool enabled = false;
  std::string variantName;
  std::string variantPayload;
  int flagVersion = 0;
  std::string timestamp;
};

// ==================== Stats ====================

struct EventHandlerStats {
  std::string name;
  int callCount = 0;
  bool isOnce = false;
  std::string registeredAt;
};

struct FlagEnabledCount {
  int yes = 0;
  int no = 0;
};

struct GatrixSdkStats {
  // Counts
  int totalFlagCount = 0;
  int fetchFlagsCount = 0;
  int updateCount = 0;
  int notModifiedCount = 0;
  int errorCount = 0;
  int recoveryCount = 0;
  int impressionCount = 0;
  int contextChangeCount = 0;
  int syncFlagsCount = 0;
  int metricsSentCount = 0;
  int metricsErrorCount = 0;

  // Timestamps (empty string means null)
  std::string startTime;
  std::string lastFetchTime;
  std::string lastUpdateTime;
  std::string lastErrorTime;
  std::string lastRecoveryTime;

  // State
  SdkState sdkState = SdkState::INITIALIZING;
  std::string etag;
  bool offlineMode = false;
  std::string lastError;
  std::map<std::string, int> missingFlags;

  // Per-flag data
  std::map<std::string, FlagEnabledCount> flagEnabledCounts;
  std::map<std::string, std::map<std::string, int>> flagVariantCounts;
  std::map<std::string, std::string> flagLastChangedTimes;
  std::vector<std::string> activeWatchGroups;

  // Event handler stats
  std::map<std::string, std::vector<EventHandlerStats>> eventHandlerStats;
};

// ==================== Config ====================

struct FetchRetryOptions {
  std::vector<int> nonRetryableStatusCodes = {401, 403};
  int initialBackoffMs = 1000; // Initial backoff delay in ms
  int maxBackoffMs = 60000;    // Maximum backoff delay in ms
};

struct GatrixClientConfig {
  // Required
  std::string apiUrl;
  std::string apiToken;
  std::string appName;
  std::string environment;

  // Optional - Polling
  int refreshInterval = 30; // seconds
  bool disableRefresh = false;

  // Optional - Context
  GatrixContext context;

  // Optional - Sync Mode
  bool explicitSyncMode = false;

  // Optional - Offline
  bool offlineMode = false;

  // Optional - Bootstrap
  std::vector<EvaluatedFlag> bootstrap;
  bool bootstrapOverride = false;

  // Optional - Advanced
  std::map<std::string, std::string> customHeaders;
  bool disableMetrics = false;
  bool disableStats = false;
  bool impressionDataAll = false;
  FetchRetryOptions fetchRetryOptions;

  // Debug / Storage
  bool enableDevMode = false;
  std::string cacheKeyPrefix = "gatrix_cache";
};

// ==================== Error ====================

class GatrixFeatureError : public std::exception {
public:
  GatrixFeatureError(const std::string &message, const std::string &code = "")
      : _message(message), _code(code) {}

  const char *what() const noexcept override { return _message.c_str(); }
  const std::string &code() const { return _code; }

private:
  std::string _message;
  std::string _code;
};

// ==================== Storage Provider ====================

class IStorageProvider {
public:
  virtual ~IStorageProvider() = default;
  virtual std::string get(const std::string &key) = 0;
  virtual void save(const std::string &key, const std::string &value) = 0;
  virtual void remove(const std::string &key) = 0;
};

class InMemoryStorageProvider : public IStorageProvider {
public:
  std::string get(const std::string &key) override {
    auto it = _data.find(key);
    return it != _data.end() ? it->second : "";
  }
  void save(const std::string &key, const std::string &value) override {
    _data[key] = value;
  }
  void remove(const std::string &key) override { _data.erase(key); }

private:
  std::map<std::string, std::string> _data;
};

} // namespace gatrix

#endif // GATRIX_TYPES_H
