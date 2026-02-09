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
