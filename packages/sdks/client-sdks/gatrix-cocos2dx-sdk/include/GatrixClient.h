#ifndef GATRIX_CLIENT_H
#define GATRIX_CLIENT_H

#include "GatrixEventEmitter.h"
#include "GatrixEvents.h"
#include "GatrixFeaturesClient.h"
#include "GatrixTypes.h"
#include "GatrixVersion.h"
#include <functional>
#include <string>

namespace gatrix {

/**
 * GatrixClient - Main entry point for Gatrix SDK (from CLIENT_SDK_SPEC.md)
 */
class GatrixClient {
public:
  static GatrixClient *getInstance();
  static const char *sdkName() { return SDK_NAME; }
  static const char *sdkVersion() { return SDK_VERSION; }
  static const char *version() { return SDK_VERSION; }

  void init(const GatrixClientConfig &config);
  void start();
  void stop();
  bool isReady() const;
  std::string getError() const;

  // Access to FeaturesClient
  FeaturesClient *features() { return _features; }

  // Event Subscription (delegates to EventEmitter)
  void on(const std::string &event, GatrixEventCallback callback,
          const std::string &name = "");
  void once(const std::string &event, GatrixEventCallback callback,
            const std::string &name = "");
  void off(const std::string &event, GatrixEventCallback callback = nullptr);
  void onAny(GatrixAnyCallback callback, const std::string &name = "");
  void offAny();

  // Direct emitter access (for advanced usage)
  GatrixEventEmitter &emitter() { return _emitter; }

private:
  GatrixClient();
  ~GatrixClient();

  static GatrixClient *_instance;

  GatrixClientConfig _config;
  GatrixEventEmitter _emitter;
  FeaturesClient *_features = nullptr;
  bool _initialized = false;
};

} // namespace gatrix

#endif // GATRIX_CLIENT_H
