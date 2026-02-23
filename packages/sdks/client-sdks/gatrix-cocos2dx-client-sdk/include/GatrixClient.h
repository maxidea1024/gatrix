#ifndef GATRIX_CLIENT_H
#define GATRIX_CLIENT_H

#include "GatrixEventEmitter.h"
#include "GatrixEvents.h"
#include "GatrixFeaturesClient.h"
#include "GatrixTypes.h"
#include "GatrixVersion.h"
#include <functional>
#include <string>
#include <unordered_map>

namespace gatrix {

/**
 * GatrixClient - Main entry point for Gatrix SDK (from CLIENT_SDK_SPEC.md)
 */
class GatrixClient {
public:
  static GatrixClient* getInstance();
  static const char* sdkName() { return SDK_NAME; }
  static const char* sdkVersion() { return SDK_VERSION; }
  static const char* version() { return SDK_VERSION; }

  /** Start the SDK with configuration */
  void start(const GatrixClientConfig& config);

  /**
   * Start the SDK with configuration (with completion callback).
   * onComplete(bSuccess, errorMessage) is called when the SDK first becomes
   * ready, or immediately if already ready.
   */
  void start(const GatrixClientConfig& config,
             std::function<void(bool, const std::string&)> onComplete);

  void stop();
  bool isReady() const;
  std::string getError() const;

  // Access to FeaturesClient
  FeaturesClient* features() { return _features; }

  // Event Subscription (delegates to EventEmitter)
  void on(const std::string& event, GatrixEventCallback callback, const std::string& name = "");
  void once(const std::string& event, GatrixEventCallback callback, const std::string& name = "");
  void off(const std::string& event, GatrixEventCallback callback = nullptr);
  void onAny(GatrixAnyCallback callback, const std::string& name = "");
  void offAny();

  // Direct emitter access (for advanced usage)
  GatrixEventEmitter& emitter() { return _emitter; }

  // ==================== Tracking ====================

  /**
   * Track a custom user event.
   * NOTE: Not yet implemented. This API is reserved for the upcoming
   * Gatrix Analytics service and will be fully supported in a future release.
   *
   * @param eventName  Name of the event to track
   * @param properties Optional key-value properties
   */
  void track(const std::string& eventName,
             const std::unordered_map<std::string, std::string>& properties = {});

private:
  GatrixClient();
  ~GatrixClient();

  /** Internal initialization logic (validates config, creates FeaturesClient) */
  bool initInternal(const GatrixClientConfig& config);

  static GatrixClient* _instance;

  GatrixClientConfig _config;
  GatrixEventEmitter _emitter;
  FeaturesClient* _features = nullptr;
  bool _initialized = false;
  bool _started = false;
};

} // namespace gatrix

#endif // GATRIX_CLIENT_H
