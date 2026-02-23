#include "GatrixClient.h"

namespace gatrix {

GatrixClient* GatrixClient::_instance = nullptr;

GatrixClient* GatrixClient::getInstance() {
  if (!_instance) {
    _instance = new GatrixClient();
  }
  return _instance;
}

GatrixClient::GatrixClient() {}

GatrixClient::~GatrixClient() {
  stop();
  delete _features;
  _features = nullptr;
}

bool GatrixClient::initInternal(const GatrixClientConfig& config) {
  // Validate required fields
  if (config.apiUrl.empty())
    throw GatrixFeatureError("Config validation failed: apiUrl is required");
  if (config.apiToken.empty())
    throw GatrixFeatureError("Config validation failed: apiToken is required");
  if (config.appName.empty())
    throw GatrixFeatureError("Config validation failed: appName is required");
  if (config.environment.empty())
    throw GatrixFeatureError("Config validation failed: environment is required");

  // Validate URL format
  if (config.apiUrl.substr(0, 7) != "http://" && config.apiUrl.substr(0, 8) != "https://")
    throw GatrixFeatureError(
        "Config validation failed: apiUrl must start with http:// or https://");

  // Validate numeric ranges
  if (config.refreshInterval < 1 || config.refreshInterval > 86400)
    throw GatrixFeatureError("Config validation failed: refreshInterval must "
                             "be between 1 and 86400");

  // Validate fetch retry options
  const auto& retry = config.fetchRetryOptions;
  if (retry.initialBackoff < 0.1f || retry.initialBackoff > 60.0f)
    throw GatrixFeatureError("Config validation failed: initialBackoff must "
                             "be between 0.1 and 60 seconds");
  if (retry.maxBackoff < 1.0f || retry.maxBackoff > 600.0f)
    throw GatrixFeatureError("Config validation failed: maxBackoff must be "
                             "between 1 and 600 seconds");
  if (retry.initialBackoff > retry.maxBackoff)
    throw GatrixFeatureError("Config validation failed: initialBackoff must be <= maxBackoff");
  for (int code : retry.nonRetryableStatusCodes) {
    if (code < 400 || code > 599)
      throw GatrixFeatureError("Config validation failed: nonRetryableStatusCodes must be 400-599");
  }

  // Validate cacheKeyPrefix
  if (config.cacheKeyPrefix.length() > 100)
    throw GatrixFeatureError("Config validation failed: cacheKeyPrefix must be <= 100 characters");

  _config = config;
  _features = new FeaturesClient(_config, _emitter);
  _initialized = true;
  return true;
}

void GatrixClient::start(const GatrixClientConfig& config) {
  if (_started)
    return;

  initInternal(config);
  _started = true;
  _features->start();
}

void GatrixClient::start(const GatrixClientConfig& config,
                         std::function<void(bool, const std::string&)> onComplete) {
  if (_started) {
    if (onComplete)
      onComplete(true, "");
    return;
  }

  try {
    initInternal(config);
  } catch (const std::exception& e) {
    if (onComplete)
      onComplete(false, e.what());
    return;
  }

  _started = true;
  _features->start(std::move(onComplete));
}

void GatrixClient::stop() {
  if (_features) {
    _features->stop();
  }
  _started = false;
  _initialized = false;
}

bool GatrixClient::isReady() const {
  return _features && _features->getStats().sdkState == SdkState::READY;
}

std::string GatrixClient::getError() const {
  return _features ? _features->getStats().lastError : "";
}

void GatrixClient::on(const std::string& event, GatrixEventCallback callback,
                      const std::string& name) {
  _emitter.on(event, callback, name);
}

void GatrixClient::once(const std::string& event, GatrixEventCallback callback,
                        const std::string& name) {
  _emitter.once(event, callback, name);
}

void GatrixClient::off(const std::string& event, GatrixEventCallback callback) {
  _emitter.off(event, callback);
}

void GatrixClient::onAny(GatrixAnyCallback callback, const std::string& name) {
  _emitter.onAny(callback, name);
}

void GatrixClient::offAny() {
  _emitter.offAny();
}

void GatrixClient::track(const std::string& eventName,
                         const std::unordered_map<std::string, std::string>& properties) {
  // Not yet implemented — reserved for the upcoming Gatrix Analytics service.
  (void)eventName;
  (void)properties;
}

} // namespace gatrix
