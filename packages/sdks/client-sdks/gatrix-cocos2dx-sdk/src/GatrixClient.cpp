#include "GatrixClient.h"

namespace gatrix {

GatrixClient *GatrixClient::_instance = nullptr;

GatrixClient *GatrixClient::getInstance() {
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

void GatrixClient::init(const GatrixClientConfig &config) {
  if (_initialized)
    return;

  // Validate required fields
  if (config.apiUrl.empty())
    throw GatrixFeatureError("Config validation failed: apiUrl is required");
  if (config.apiToken.empty())
    throw GatrixFeatureError("Config validation failed: apiToken is required");
  if (config.appName.empty())
    throw GatrixFeatureError("Config validation failed: appName is required");
  if (config.environment.empty())
    throw GatrixFeatureError(
        "Config validation failed: environment is required");

  // Validate URL format
  if (config.apiUrl.substr(0, 7) != "http://" &&
      config.apiUrl.substr(0, 8) != "https://")
    throw GatrixFeatureError(
        "Config validation failed: apiUrl must start with http:// or https://");

  // Validate numeric ranges
  if (config.refreshInterval < 1 || config.refreshInterval > 86400)
    throw GatrixFeatureError("Config validation failed: refreshInterval must "
                             "be between 1 and 86400");

  // Validate fetch retry options
  const auto &retry = config.fetchRetryOptions;
  if (retry.initialBackoffMs < 100 || retry.initialBackoffMs > 60000)
    throw GatrixFeatureError("Config validation failed: initialBackoffMs must "
                             "be between 100 and 60000");
  if (retry.maxBackoffMs < 1000 || retry.maxBackoffMs > 600000)
    throw GatrixFeatureError("Config validation failed: maxBackoffMs must be "
                             "between 1000 and 600000");
  if (retry.initialBackoffMs > retry.maxBackoffMs)
    throw GatrixFeatureError(
        "Config validation failed: initialBackoffMs must be <= maxBackoffMs");
  for (int code : retry.nonRetryableStatusCodes) {
    if (code < 400 || code > 599)
      throw GatrixFeatureError(
          "Config validation failed: nonRetryableStatusCodes must be 400-599");
  }

  // Validate cacheKeyPrefix
  if (config.cacheKeyPrefix.length() > 100)
    throw GatrixFeatureError(
        "Config validation failed: cacheKeyPrefix must be <= 100 characters");

  _config = config;
  _features = new FeaturesClient(_config, _emitter);
  _initialized = true;
}

void GatrixClient::start() {
  if (!_initialized)
    return;
  _features->start();
}

void GatrixClient::stop() {
  if (_features) {
    _features->stop();
  }
}

bool GatrixClient::isReady() const {
  return _features && _features->getStats().sdkState == SdkState::READY;
}

std::string GatrixClient::getError() const {
  return _features ? _features->getStats().lastError : "";
}

void GatrixClient::on(const std::string &event, GatrixEventCallback callback,
                      const std::string &name) {
  _emitter.on(event, callback, name);
}

void GatrixClient::once(const std::string &event, GatrixEventCallback callback,
                        const std::string &name) {
  _emitter.once(event, callback, name);
}

void GatrixClient::off(const std::string &event, GatrixEventCallback callback) {
  _emitter.off(event, callback);
}

void GatrixClient::onAny(GatrixAnyCallback callback, const std::string &name) {
  _emitter.onAny(callback, name);
}

void GatrixClient::offAny() { _emitter.offAny(); }

} // namespace gatrix
